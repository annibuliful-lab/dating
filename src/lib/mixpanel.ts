import mixpanel from 'mixpanel-browser';

let isInitialized = false;

export type MixpanelProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

function initializeMixpanel() {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return false;

  if (!isInitialized) {
    mixpanel.init(token, {
      track_pageview: false,
      persistence: 'localStorage',
      batch_requests: true,
      batch_autostart: true,
      batch_size: 10,
      batch_flush_interval_ms: 5000,
      batch_request_timeout_ms: 10000,
    });
    isInitialized = true;
  }

  return true;
}

export function identifyUser(
  userId: string,
  profileProperties?: MixpanelProperties,
) {
  if (!userId?.trim()) return;
  if (!initializeMixpanel()) return;
  mixpanel.identify(userId);

  if (profileProperties) {
    mixpanel.people.set(profileProperties);
  }
}

export function trackEvent(
  eventName: string,
  properties?: MixpanelProperties,
) {
  if (!initializeMixpanel()) return;
  mixpanel.track(eventName, properties);
}
