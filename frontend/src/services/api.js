import axios from 'axios';

const api = axios.create({
  baseURL: '/api',  // ← تغيّر من http://localhost:5000/api
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor عشان الـ Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;