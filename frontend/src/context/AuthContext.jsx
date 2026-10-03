import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  useEffect(() => {
    // Check session persistence
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    const verifySession = async () => {
      if (storedToken && storedUser) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          // Query the backend to verify the token is still valid
          const response = await axios.get('/api/auth/me');
          setUser(response.data.user);
          setToken(storedToken);
        } catch (error) {
          console.warn('Session verification failed, logging out:', error.message);
          logout();
        }
      }
      setLoading(false);
    };

    verifySession();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { token: idToken, user: userData } = response.data;
      
      localStorage.setItem('token', idToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(idToken);
      setUser(userData);
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${idToken}`;
      setLoading(false);
      return { success: true, user: userData };
    } catch (error) {
      setLoading(false);
      const message = error.response?.data?.error || 'Authentication failed. Please verify connection.';
      return { success: false, error: message };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await axios.post('/api/auth/forgot-password', { email });
      return { success: true, message: response.data.message };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to dispatch reset email. Please try again.';
      return { success: false, error: message };
    }
  };

  const updateProfile = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    logout,
    forgotPassword,
    updateProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
