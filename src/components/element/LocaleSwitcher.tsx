'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import { Button } from '@mantine/core';

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const nextLocale = locale === 'th' ? 'en' : 'th';
  return (
    <Button
      variant="subtle"
      size="compact-xs"
      color="gray"
      aria-label={`${t('language')} (${nextLocale === 'th' ? t('thai') : t('english')})`}
      onClick={() => setLocale(nextLocale)}
    >
      {locale === 'th' ? 'EN' : 'ไทย'}
    </Button>
  );
}
