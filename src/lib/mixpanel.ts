import mixpanel from 'mixpanel-browser';

let isInitialized = false;

export type MixpanelProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export function trackEvent(
  eventName: string,
  properties?: MixpanelProperties,
) {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return;

  if (!isInitialized) {
    mixpanel.init(token, {
      track_pageview: false,
      persistence: 'localStorage',
    });
    isInitialized = true;
  }

  mixpanel.track(eventName, properties);
}
