import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type MobileAlertPermission = 'granted' | 'denied' | 'unsupported';

interface StaffMobileAlert {
  title: string;
  body: string;
  tag: string;
  path: '/required' | '/incoming';
  forceDeviceNotification?: boolean;
}

const isNotificationSupported = () => (
  typeof window !== 'undefined' && typeof Notification !== 'undefined'
);

const isNativeDevice = () => Capacitor.isNativePlatform();

const getNotificationId = (tag: string) => {
  let hash = 0;
  for (let index = 0; index < tag.length; index += 1) {
    hash = ((hash << 5) - hash + tag.charCodeAt(index)) | 0;
  }
  return (hash & 0x7fffffff) || 1;
};

const ensureAndroidAlertChannel = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id: 'requireapp-alerts',
    name: 'REQUIRE alerts',
    description: 'Requirement and incoming item updates',
    importance: 4,
    visibility: 1,
    vibration: true,
    lightColor: '#EFC464'
  });
};

export const areStaffMobileAlertsEnabled = async () => {
  if (isNativeDevice()) {
    try {
      return (await LocalNotifications.checkPermissions()).display === 'granted';
    } catch {
      return false;
    }
  }
  return isNotificationSupported() && Notification.permission === 'granted';
};

export const requestStaffMobileAlerts = async (): Promise<MobileAlertPermission> => {
  if (isNativeDevice()) {
    try {
      await ensureAndroidAlertChannel();
      return (await LocalNotifications.requestPermissions()).display === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return (await Notification.requestPermission()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
};

export const sendStaffMobileAlert = async ({ title, body, tag, path, forceDeviceNotification = false }: StaffMobileAlert) => {
  if (isNativeDevice()) {
    if (!await areStaffMobileAlertsEnabled()) return;
    try {
      await ensureAndroidAlertChannel();
      await LocalNotifications.schedule({
        notifications: [{
          id: getNotificationId(tag),
          title,
          body,
          channelId: 'requireapp-alerts',
          extra: { path },
          foreground: true
        }]
      });
    } catch {
      // A notification failure must not interrupt the staff workflow.
    }
    return;
  }

  if (document.visibilityState === 'visible' && !forceDeviceNotification) return;
  if (!await areStaffMobileAlertsEnabled()) return;

  const options: NotificationOptions = {
    body,
    tag,
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { path }
  };

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return;
      }
    } catch {
      // Fall back to the browser notification API below.
    }
  }

  try {
    new Notification(title, options);
  } catch {
    // Some browsers only allow notifications from the service worker.
  }
};
