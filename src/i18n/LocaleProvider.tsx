'use client';

import { messages, type Locale, type MessageKey } from '@/i18n/messages';
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('th');

  useEffect(() => {
    const saved = window.localStorage.getItem('dating-locale');
    if (saved === 'th' || saved === 'en') setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem('dating-locale', locale);
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale: (nextLocale: Locale) => setLocaleState(nextLocale),
    t: (key: MessageKey) => messages[locale][key],
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}
