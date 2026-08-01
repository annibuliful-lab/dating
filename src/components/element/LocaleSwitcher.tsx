'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import { Button } from '@mantine/core';

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const nextLocale = locale === 'th' ? 'en' : 'th';
  return (
    <Button
      variant="subtle"
      size="compact-xs"
      color="gray"
      aria-label={`Switch language to ${nextLocale === 'th' ? 'Thai' : 'English'}`}
      onClick={() => setLocale(nextLocale)}
    >
      {locale === 'th' ? 'EN' : 'ไทย'}
    </Button>
  );
}
