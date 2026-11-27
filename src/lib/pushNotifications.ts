export type PushPermissionState = NotificationPermission | 'unsupported';

export interface PushNotificationPrefs {
  enabled: boolean;
  notifyIncidents: boolean;
  notifySupport: boolean;
  soundEnabled: boolean;
}

export type OperationalAlertKind =
  | 'support'
  | 'incident'
  | 'environmental'
  | 'traffic'
  | 'homicide'
  | 'public_order'
  | 'access_request'
  | 'test';

export interface OperationalAlertItem {
  id: string;
  kind: OperationalAlertKind;
  title: string;
  body: string;
  sector: string;
  lat?: number;
  lng?: number;
  commissionId?: string;
  timestampMs: number;
  read: boolean;
}

const PREFS_STORAGE_KEY = 'dcr231_push_prefs_v1';

export const DEFAULT_PUSH_PREFS: PushNotificationPrefs = {
  enabled: true,
  notifyIncidents: true,
  notifySupport: true,
  soundEnabled: true,
};

export function loadPushPrefs(): PushNotificationPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PUSH_PREFS;
    const parsed = JSON.parse(raw) as Partial<PushNotificationPrefs>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      notifyIncidents:
        typeof parsed.notifyIncidents === 'boolean' ? parsed.notifyIncidents : true,
      notifySupport:
        typeof parsed.notifySupport === 'boolean' ? parsed.notifySupport : true,
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
    };
  } catch {
    return DEFAULT_PUSH_PREFS;
  }
}

export function savePushPrefs(prefs: PushNotificationPrefs): void {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or private browsing restrictions
  }
}

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function isIOSBrowserNotStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !isStandalone;
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export interface SystemPushPayload {
  title: string;
  body: string;
  tag: string;
  urgent?: boolean;
  onClick?: () => void;
}

/**
 * Dispatches an OS-level browser/PWA push notification if permission is granted.
 * Prefers ServiceWorkerRegistration.showNotification() for Android/PWA reliability,
 * with a clean fallback to the standard Web Notification constructor.
 */
export async function dispatchSystemPushNotification(
  payload: SystemPushPayload
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: payload.body,
    icon: '/assets/aistudio/ESCUDO_DCR23-1_11250c43.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag,
    renotify: true,
    requireInteraction: Boolean(payload.urgent),
    vibrate: payload.urgent ? [250, 120, 250, 120, 300] : [160, 80, 160],
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(payload.title, options);
        return true;
      }
    }
  } catch {
    // Fall through to standard Notification API
  }

  try {
    const notif = new Notification(payload.title, options);
    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore focus errors in iframe contexts
      }
      notif.close();
      payload.onClick?.();
    };
    return true;
  } catch {
    return false;
  }
}
