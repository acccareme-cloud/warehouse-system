// frontend/src/context/LanguageContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translate } from '../i18n/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('app-lang') || 'ar');

  useEffect(() => {
    localStorage.setItem('app-lang', lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  const setLang = (l) => setLangState(l === 'en' ? 'en' : 'ar');
  const toggleLang = () => setLangState((prev) => (prev === 'ar' ? 'en' : 'ar'));

  // t('login.heading') أو t('login.errServer', { code: 500 })
  const t = useCallback((key, params) => translate(lang, key, params), [lang]);

  const isRtl = lang === 'ar';

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
