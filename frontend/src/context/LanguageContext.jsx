// frontend/src/context/LanguageContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { translate } from '../i18n/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('app-lang') || 'ar');

  useEffect(() => {
    localStorage.setItem('app-lang', lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  const setLang = useCallback((l) => setLangState(l === 'en' ? 'en' : 'ar'), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === 'ar' ? 'en' : 'ar')), []);
  const t = useCallback((key, params) => translate(lang, key, params), [lang]);
  const isRtl = lang === 'ar';

  const value = useMemo(() => ({ lang, setLang, toggleLang, t, isRtl }), [lang, setLang, toggleLang, t, isRtl]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}


export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}