// frontend/src/components/BrandingSettingsTab.jsx
//
// تاب "عام" جوه شاشة الإعدادات (Settings.jsx) — تعديل اسم البرنامج واسم الشركة
// بالعربي والإنجليزي. أدمن بس يقدر يشوفه (زي باقي التابات الحساسة في الشاشة).
//
// طريقة الدمج جوه Settings.jsx:
//   1) import BrandingSettingsTab from '../components/BrandingSettingsTab';
//   2) ضيف زرار تاب جديد: { key: 'general', label: t('settings.generalTab') }
//   3) لما activeTab === 'general' اعرض: <BrandingSettingsTab showMessage={showMessage} />

import { useState, useEffect } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useBranding } from '../context/BrandingContext';
import { useTheme } from '../context/ThemeContext';
import { getColors } from '../theme';

function BrandingSettingsTab({ showMessage }) {
  const { t } = useLanguage();
  const { theme: themeMode } = useTheme();
  const c = getColors(themeMode === 'dark');
  const { branding, refresh } = useBranding();

  const [form, setForm] = useState({
    program_name_ar: '',
    program_name_en: '',
    company_name_ar: '',
    company_name_en: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (branding) {
      setForm({
        program_name_ar: branding.program_name_ar || '',
        program_name_en: branding.program_name_en || '',
        company_name_ar: branding.company_name_ar || '',
        company_name_en: branding.company_name_en || '',
      });
    }
  }, [branding]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', form);
      await refresh();
      showMessage?.('✅ ' + t('settings.brandingSaved'));
    } catch (err) {
      showMessage?.('❌ ' + (err.response?.data?.error || t('common.error')));
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    width: '100%',
    padding: '10px 12px',
    background: c.input,
    border: `1px solid ${c.border}`,
    borderRadius: '8px',
    color: c.text,
    fontSize: '14px',
    boxSizing: 'border-box',
    marginBottom: '16px',
  };
  const labelStyle = { display: 'block', color: c.textMuted, fontSize: '13px', marginBottom: '6px' };

  const fields = [
    ['program_name_ar', t('settings.programNameAr')],
    ['program_name_en', t('settings.programNameEn')],
    ['company_name_ar', t('settings.companyNameAr')],
    ['company_name_en', t('settings.companyNameEn')],
  ];

  return (
    <div style={{ maxWidth: '480px' }}>
      {fields.map(([key, label]) => (
        <div key={key}>
          <label style={labelStyle}>{label}</label>
          <input
            style={fieldStyle}
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 22px',
          background: c.primary,
          color: '#04211F',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? t('common.loading') : t('settings.saveBranding')}
      </button>
    </div>
  );
}

export default BrandingSettingsTab;
