import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // تطبيق الـ theme على كل الـ body
    if (theme === 'dark') {
      document.body.style.backgroundColor = '#0f172a';
      document.body.style.color = '#f1f5f9';
    } else {
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#1e293b';
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setDark = () => setTheme('dark');
  const setLight = () => setTheme('light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setDark, setLight }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}