import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  const login = (data) => {
    // ✅ data = { token, user: { id, username, role, full_name } }
    const { token, user } = data;
    
    // نخزن الـ token لوحده
    localStorage.setItem('token', token);
    
    // نخزن الـ user لوحده (مش الـ data كله)
    localStorage.setItem('user', JSON.stringify(user));
    
    // نحط الـ user في الـ state
    setUser(user);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);