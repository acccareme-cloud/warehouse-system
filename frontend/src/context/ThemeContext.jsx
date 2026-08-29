import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    // توافق مع القيمة القديمة (darkMode: true/false) لو موجودة من نسخة سابقة
    const legacy = localStorage.getItem('darkMode');
    if (legacy) return JSON.parse(legacy) ? 'dark' : 'light';
    return 'light';
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, isDark]);

  const setDark = () => setTheme('dark');
  const setLight = () => setTheme('light');
  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, isDark, setDark, setLight, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
