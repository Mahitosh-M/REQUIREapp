import {
  Bell,
  BellRing,
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  PackageOpen,
  Plus,
  RefreshCw,
  ScanSearch,
  Send,
  Users,
  WifiOff,
  type LucideIcon
} from 'lucide-react';
import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useStaffMobileAlerts } from '../hooks/useStaffMobileAlerts';
import { areStaffMobileAlertsEnabled, requestStaffMobileAlerts, sendStaffMobileAlert } from '../services/mobileAlertService';
import type { ShopId } from '../types';
import { getShopName, SHOP_OPTIONS } from '../utils/shops';
import { SegmentedControl, useToast } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { to: '/required', label: 'Required', icon: ClipboardList },
  { to: '/company-orders', label: 'Company Orders', icon: Building2, adminOnly: true },
  { to: '/to-send', label: 'To Send', icon: Send },
  { to: '/incoming', label: 'Incoming', icon: PackageOpen },
  { to: '/products', label: 'Products', icon: Boxes, adminOnly: true },
  { to: '/product-review', label: 'Product Review', icon: ScanSearch, adminOnly: true },
  { to: '/companies', label: 'Companies', icon: Building2, adminOnly: true },
  { to: '/users', label: 'Users', icon: Users, adminOnly: true }
];

const bottomAdminRoutes = new Set(['/dashboard', '/required', '/company-orders', '/to-send', '/incoming']);

const Brand = () => (
  <div className="brand-lockup">
    <span className="brand-mark"><PackageCheck size={24} /></span>
    <span><strong>REQUIRE</strong><small>Shop requirements</small></span>
  </div>
);

export const AppShell = () => {
  const { profile, actingShopId, setActingShopId, logout } = useAuth();
  const location = useLocation();
  const online = useOnlineStatus();
  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';
  const toast = useToast();
  const pullStartY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileAlertsEnabled, setMobileAlertsEnabled] = useState(false);
  const visibleNavigation = navigation.filter((item) => !item.adminOnly || isAdmin);
  const bottomNavigation = isAdmin
    ? visibleNavigation.filter((item) => bottomAdminRoutes.has(item.to))
    : visibleNavigation.filter((item) => ['/required', '/to-send', '/incoming'].includes(item.to));

  useStaffMobileAlerts({
    staffShopId: isStaff ? actingShopId : null,
    listenForRequired: isStaff && location.pathname !== '/required',
    listenForIncoming: isStaff && location.pathname !== '/incoming',
    notify: toast
  });

  useEffect(() => {
    let active = true;
    if (!isStaff) {
      setMobileAlertsEnabled(false);
      return () => { active = false; };
    }

    void areStaffMobileAlertsEnabled().then((enabled) => {
      if (active) setMobileAlertsEnabled(enabled);
    });
    return () => { active = false; };
  }, [isStaff]);

  const resetPull = () => {
    pullStartY.current = null;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  };

  const beginPull = (event: TouchEvent<HTMLElement>) => {
    pullStartY.current = event.currentTarget.scrollTop <= 0 && event.touches.length === 1
      ? event.touches[0].clientY
      : null;
  };

  const trackPull = (event: TouchEvent<HTMLElement>) => {
    if (pullStartY.current === null || event.currentTarget.scrollTop > 0 || event.touches.length !== 1) return;
    const distance = Math.max(0, event.touches[0].clientY - pullStartY.current);
    const nextDistance = Math.min(80, distance * 0.45);
    pullDistanceRef.current = nextDistance;
    setPullDistance(nextDistance);
  };

  const finishPull = () => {
    const shouldRefresh = pullDistanceRef.current >= 64 && !isRefreshing;
    resetPull();
    if (!shouldRefresh) return;
    setIsRefreshing(true);
    window.setTimeout(() => window.location.reload(), 120);
  };

  const enableMobileAlerts = async () => {
    const permission = await requestStaffMobileAlerts();
    const enabled = permission === 'granted';
    setMobileAlertsEnabled(enabled);
    if (enabled) {
      void sendStaffMobileAlert({
        title: 'REQUIRE alerts enabled',
        body: 'Requirement and incoming item alerts are ready.',
        tag: 'requireapp-alerts-enabled',
        path: '/required',
        forceDeviceNotification: true
      });
      toast('Mobile alerts enabled.', 'success');
      return;
    }
    if (permission === 'unsupported') {
      toast('This browser does not support mobile alerts.', 'info');
      return;
    }
    toast('Allow notifications in browser settings to enable alerts.', 'error');
  };

  return (
    <div className="application-shell">
      <div className="application-main">
        <header className="topbar">
          <div className="topbar__mobile-brand"><Brand /></div>
          <div className="topbar__context">
            {isAdmin ? (
              <SegmentedControl<ShopId>
                label="Operational shop"
                value={actingShopId || 'SHOP_A'}
                onChange={setActingShopId}
                options={SHOP_OPTIONS.map((shop) => ({ value: shop.id, label: shop.name }))}
              />
            ) : <span className="shop-pill">{actingShopId ? getShopName(actingShopId) : 'No shop assigned'}</span>}
            {!online ? <span className="offline-pill"><WifiOff size={15} /> Offline</span> : null}
          </div>
          {isStaff ? (
            <button
              className={`icon-button topbar__alerts ${mobileAlertsEnabled ? 'is-enabled' : ''}`}
              type="button"
              onClick={() => void enableMobileAlerts()}
              title={mobileAlertsEnabled ? 'Mobile alerts enabled' : 'Enable mobile alerts'}
            >
              {mobileAlertsEnabled ? <BellRing size={19} /> : <Bell size={19} />}
            </button>
          ) : null}
          <button className="icon-button topbar__logout" type="button" onClick={() => void logout()} title="Log out"><LogOut size={19} /></button>
        </header>

        <div
          className={`pull-refresh-indicator ${isRefreshing ? 'is-refreshing' : ''}`}
          style={{ opacity: Math.min(1, pullDistance / 48), transform: `translate(-50%, ${pullDistance}px)` }}
          aria-hidden="true"
        ><RefreshCw className={isRefreshing ? 'spin' : ''} size={18} /></div>

        <main className="page-content" onTouchStart={beginPull} onTouchMove={trackPull} onTouchEnd={finishPull} onTouchCancel={resetPull}><Outlet /></main>

        {location.pathname !== '/add' ? (
          <NavLink className="add-fab" to="/add" title="Add requirement"><Plus size={24} /><span>Add</span></NavLink>
        ) : null}
        <nav className={`bottom-nav bottom-nav--${bottomNavigation.length}`} aria-label="Mobile navigation">
          {bottomNavigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'is-active' : ''}>
              <Icon size={20} /><span>{label === 'Company Orders' ? 'Orders' : label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
