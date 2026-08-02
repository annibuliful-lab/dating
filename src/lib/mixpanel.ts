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
    });
    isInitialized = true;
  }

  return true;
}

export function identifyUser(userId: string) {
  if (!initializeMixpanel()) return;
  mixpanel.identify(userId);
}

export function trackEvent(
  eventName: string,
  properties?: MixpanelProperties,
) {
  if (!initializeMixpanel()) return;
  mixpanel.track(eventName, properties);
}
