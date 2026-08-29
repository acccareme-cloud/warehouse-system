import { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

function TaxSettingsTab() {
  const [settings, setSettings] = useState({
    default_tax_rate: 14,
    vat_rate: 14,
    withholding_rate: 20,
    customs_profit_tax_rate: 1
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/tax-settings');
      if (res.data) {
        setSettings({
          default_tax_rate: res.data.default_tax_rate || 14,
          vat_rate: res.data.vat_rate || res.data.default_tax_rate || 14,
          withholding_rate: res.data.withholding_rate || 20,
          customs_profit_tax_rate: res.data.customs_profit_tax_rate || 1
        });
      }
    } catch (err) {
      console.error('خطأ في تحميل الإعدادات');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/tax-settings', settings);
      setMessage('✅ تم تحديث إعدادات الضرائب بنجاح');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
             setMessage('❌ خطأ: ' + (err.response?.data?.error || err.message || 'حدث خطأ'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ padding: '10px 20px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          ← رجوع
        </button>
        <h3 style={{ margin: 0 }}>🏛️ إعدادات الضرائب</h3>
      </div>
      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
        💡 هنا بتقدر تتحكم في نسب الضرائب. لما الدولة تغير النسبة (مثلاً من 14% لـ 13% أو 15%)، غيّرها هنا.
      </p>

      {message && (
        <p style={{ padding: '12px', background: message.includes('✅') ? '#d4edda' : '#f8d7da', borderRadius: '8px', fontWeight: 'bold', marginBottom: '20px' }}>
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px', maxWidth: '600px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            💰 نسبة VAT (القيمة المضافة) %
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={settings.vat_rate}
            onChange={(e) => setSettings({...settings, vat_rate: parseFloat(e.target.value)})}
            style={{ width: '100%', padding: '12px', fontSize: '16px', border: '2px solid #d1d5db', borderRadius: '8px' }}
          />
          <small style={{ color: '#6b7280' }}>تستخدم في: المبيعات + الإفراج الجمركي</small>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            📉 نسبة الاستقطاع (Withholding) %
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={settings.withholding_rate}
            onChange={(e) => setSettings({...settings, withholding_rate: parseFloat(e.target.value)})}
            style={{ width: '100%', padding: '12px', fontSize: '16px', border: '2px solid #d1d5db', borderRadius: '8px' }}
          />
          <small style={{ color: '#6b7280' }}>تستخدم في: الفواتير الضريبية (المبيعات)</small>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            🏛️ نسبة أرباح تجارية للإفراج الجمركي %
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={settings.customs_profit_tax_rate}
            onChange={(e) => setSettings({...settings, customs_profit_tax_rate: parseFloat(e.target.value)})}
            style={{ width: '100%', padding: '12px', fontSize: '16px', border: '2px solid #d1d5db', borderRadius: '8px' }}
          />
          <small style={{ color: '#6b7280' }}>تستخدم في: الإفراج الجمركي للشحنات (الاستيراد)</small>
        </div>

        <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', border: '1px solid #ffc107' }}>
          <h4 style={{ color: '#856404', margin: '0 0 10px 0' }}>📌 ملاحظات:</h4>
          <ul style={{ color: '#856404', margin: 0, paddingRight: '20px', fontSize: '14px' }}>
            <li>تغيير النسبة هنا بيأثر على <strong>الإفراجات الجديدة</strong> فقط.</li>
            <li>الإفراجات القديمة بتفضل بنفس النسبة اللي اتعملت بيها.</li>
            <li>لو عايز تغيّر نسبة إفراج قديم، عدّلها يدوي من شاشة الشحنة.</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '14px 40px',
            background: loading ? '#9ca3af' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loading ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
        </button>
      </form>
    </div>
  );
}

export default TaxSettingsTab;
