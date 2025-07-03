import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class AuthService {
  constructor() {
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle auth errors
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  async login(credentials) {
    try {
      const response = await axios.post(`${API_URL}/login`, credentials);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  async validateToken(token) {
    try {
      // Decode JWT to get user data (basic validation)
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Check if token is expired
      if (payload.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }
      
      return {
        id: payload.id,
        username: payload.username,
        role: payload.role
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  logout() {
    localStorage.removeItem('token');
  }

  isAuthenticated() {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getUser() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: payload.id,
        username: payload.username,
        role: payload.role
      };
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();