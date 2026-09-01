// frontend/src/context/BrandingContext.jsx
// بيجيب اسم البرنامج/الشركة (عربي وإنجليزي) من /api/settings ويحطهم متاحين لكل الشاشات.
// شاشة تعديلهم في Settings.jsx (تاب "عام") بتستخدم refresh() بعد الحفظ.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useLanguage } from './LanguageContext';

const BrandingContext = createContext();

const DEFAULTS = {
  program_name_ar: 'نظام كير ميد',
  program_name_en: 'Care Med System',
  company_name_ar: 'شركة كير ميد',
  company_name_en: 'Care Med Company',
  logo_url: null,
};

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const { lang } = useLanguage();

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setBranding(res.data);
    } catch {
      // السيرفر ممكن يكون واقع (مثلاً في شاشة اللوجين قبل ما الباك إند يشتغل) — سيب القيم الافتراضية
      setBranding(DEFAULTS);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // اسم البرنامج/الشركة بلغة الواجهة الحالية، جاهز للعرض المباشر
  const programName = lang === 'ar' ? branding.program_name_ar : branding.program_name_en;
  const companyName = lang === 'ar' ? branding.company_name_ar : branding.company_name_en;

  useEffect(() => {
    if (programName) document.title = programName;
  }, [programName]);

  return (
    <BrandingContext.Provider value={{ branding, programName, companyName, loaded, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
