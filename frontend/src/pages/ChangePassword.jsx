import { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function ChangePassword() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (formData.new_password !== formData.confirm_password) {
      setError('كلمة السر الجديدة غير متطابقة');
      return;
    }

    if (formData.new_password.length < 6) {
      setError('كلمة السر يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    try {
      await api.put('/auth/change-password', {
        current_password: formData.current_password,
        new_password: formData.new_password
      });
      setMessage('تم تغيير كلمة السر بنجاح');
      setFormData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🔐 تغيير كلمة السر</h1>
        <p style={styles.subtitle}>المستخدم: {user?.full_name || user?.username}</p>
        
        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>كلمة السر الحالية:</label>
            <input
              type="password"
              value={formData.current_password}
              onChange={(e) => setFormData({...formData, current_password: e.target.value})}
              required
              style={styles.input}
            />
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>كلمة السر الجديدة:</label>
            <input
              type="password"
              value={formData.new_password}
              onChange={(e) => setFormData({...formData, new_password: e.target.value})}
              required
              style={styles.input}
            />
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>تأكيد كلمة السر الجديدة:</label>
            <input
              type="password"
              value={formData.confirm_password}
              onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
              required
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.button}>
            💾 حفظ التغييرات
          </button>
        </form>

        <button 
          onClick={() => window.location.href = '/dashboard'}
          style={styles.backButton}
        >
          🔙 رجوع للوحة التحكم
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    direction: 'rtl',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '450px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '24px',
    color: '#1e293b',
    textAlign: 'center',
  },
  subtitle: {
    margin: '0 0 30px 0',
    color: '#64748b',
    textAlign: 'center',
    fontSize: '14px',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#374151',
    fontSize: '14px',
    fontWeight: '600',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '10px',
  },
  backButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#e2e8f0',
    color: '#475569',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '10px',
  },
  success: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center',
    fontSize: '14px',
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'center',
    fontSize: '14px',
  },
};

export default ChangePassword;