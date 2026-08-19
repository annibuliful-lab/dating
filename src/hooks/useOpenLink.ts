export function useOpenLink() {
  return {
    openLineLink: function (appUrl: string, webUrl: string) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(
        window.navigator.userAgent,
      );

      if (!isMobile) {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      const fallbackTimer = window.setTimeout(() => {
        window.location.href = webUrl;
      }, 1200);

      const handleVisibilityChange = () => {
        if (document.hidden) {
          window.clearTimeout(fallbackTimer);
          document.removeEventListener(
            'visibilitychange',
            handleVisibilityChange,
          );
        }
      };

      document.addEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
      window.location.href = appUrl;
    },
  };
}
