import { AlertCircle, LoaderCircle, LogOut, PackageCheck, RefreshCw } from 'lucide-react';
import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './context/AuthContext';
import { AddRequirementPage } from './pages/AddRequirementPage';

const LAZY_RELOAD_KEY = 'requireapp:lazy-page-reload';

const lazyPage = (load: () => Promise<{ default: ComponentType }>) => lazy(async () => {
  try {
    const page = await load();
    window.sessionStorage.removeItem(LAZY_RELOAD_KEY);
    return page;
  } catch (error) {
    const retried = window.sessionStorage.getItem(LAZY_RELOAD_KEY) === 'true';
    if (!retried) {
      window.sessionStorage.setItem(LAZY_RELOAD_KEY, 'true');
      window.location.reload();
      return new Promise<never>(() => undefined);
    }
    window.sessionStorage.removeItem(LAZY_RELOAD_KEY);
    throw error;
  }
});

const LoginPage = lazyPage(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RequiredPage = lazyPage(() => import('./pages/RequiredPage').then((module) => ({ default: module.RequiredPage })));
const ToSendPage = lazyPage(() => import('./pages/ToSendPage').then((module) => ({ default: module.ToSendPage })));
const IncomingPage = lazyPage(() => import('./pages/IncomingPage').then((module) => ({ default: module.IncomingPage })));
const AdminDashboardPage = lazyPage(() => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const CompanyOrdersPage = lazyPage(() => import('./pages/CompanyOrdersPage').then((module) => ({ default: module.CompanyOrdersPage })));
const CompaniesPage = lazyPage(() => import('./pages/CompaniesPage').then((module) => ({ default: module.CompaniesPage })));
const ProductsPage = lazyPage(() => import('./pages/ProductsPage').then((module) => ({ default: module.ProductsPage })));
const ProductReviewPage = lazyPage(() => import('./pages/ProductReviewPage').then((module) => ({ default: module.ProductReviewPage })));
const UsersPage = lazyPage(() => import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })));

const BootScreen = () => (
  <main className="boot-screen">
    <span className="boot-screen__mark"><PackageCheck size={30} /></span>
    <div className="boot-screen__copy"><strong>REQUIRE</strong><span>Preparing requirements</span></div>
    <LoaderCircle className="spin boot-screen__loader" size={22} />
  </main>
);

const SessionRecoveryScreen = () => {
  const { error, logout, refreshProfile } = useAuth();
  return (
    <main className="boot-screen boot-screen--access-error">
      <span className="boot-screen__mark"><AlertCircle size={30} /></span>
      <div className="boot-screen__copy">
        <strong>Account still signed in</strong>
        <span>{error || 'Your access details could not be loaded. Try again when you are online.'}</span>
      </div>
      <div className="boot-screen__actions">
        <button className="button button--secondary" type="button" onClick={() => void refreshProfile()}>Try again</button>
        <button className="icon-button" type="button" onClick={() => void logout()} title="Log out"><LogOut size={19} /></button>
      </div>
    </main>
  );
};

class RouteErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: Readonly<{ children: ReactNode; resetKey: string }>) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="boot-screen boot-screen--access-error">
        <span className="boot-screen__mark"><AlertCircle size={30} /></span>
        <div className="boot-screen__copy"><strong>Could not open this page</strong><span>Reload the app and try again.</span></div>
        <button className="icon-button" type="button" onClick={() => window.location.reload()} title="Reload"><RefreshCw size={19} /></button>
      </main>
    );
  }
}

const AdminOnly = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  return profile?.role === 'admin' ? children : <Navigate to="/required" replace />;
};

export const App = () => {
  const { firebaseUser, profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (firebaseUser && !profile) return <SessionRecoveryScreen />;

  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<BootScreen />}>
        {!profile ? (
          <Routes><Route path="*" element={<LoginPage />} /></Routes>
        ) : (
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to={profile.role === 'admin' ? '/dashboard' : '/required'} replace />} />
              <Route path="required" element={<RequiredPage />} />
              <Route path="add" element={<AddRequirementPage />} />
              <Route path="to-send" element={<ToSendPage />} />
              <Route path="incoming" element={<IncomingPage />} />
              <Route path="dashboard" element={<AdminOnly><AdminDashboardPage /></AdminOnly>} />
              <Route path="company-orders" element={<AdminOnly><CompanyOrdersPage /></AdminOnly>} />
              <Route path="companies" element={<AdminOnly><CompaniesPage /></AdminOnly>} />
              <Route path="products" element={<AdminOnly><ProductsPage /></AdminOnly>} />
              <Route path="product-review" element={<AdminOnly><ProductReviewPage /></AdminOnly>} />
              <Route path="users" element={<AdminOnly><UsersPage /></AdminOnly>} />
              <Route path="*" element={<Navigate to={profile.role === 'admin' ? '/dashboard' : '/required'} replace />} />
            </Route>
          </Routes>
        )}
      </Suspense>
    </RouteErrorBoundary>
  );
};
