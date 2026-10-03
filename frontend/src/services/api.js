import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auto-inject authorization headers before sending requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Global interceptor to handle authorization expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request. Clearing local session.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // If we are in browser, we can force redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Structured API requests
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me')
};

export const userAPI = {
  list: (params) => api.get('/users', { params: { all: 'true', ...params } }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`)
};

export const faceAPI = {
  getProfile: (userId) => api.get('/face/profile', { params: { userId } }),
  enroll: (userId, faceFeatures) => api.post('/face/enroll', { userId, faceFeatures }),
  verify: (userId, faceFeatures) => api.post('/face/verify', { userId, faceFeatures }),
  deleteProfile: (userId) => api.delete('/face/profile', { params: { userId } }),
  recognize: (faceFeatures, threshold) => api.post('/face/recognize', { faceFeatures, threshold })
};

export const attendanceAPI = {
  getActiveSessions: () => api.get('/attendance/sessions/active'),
  getSessions: (filters) => api.get('/attendance/sessions', { params: filters }),
  startSession: (data) => api.post('/attendance/sessions/start', data),
  approveSession: (id) => api.post(`/attendance/sessions/${id}/approve`),
  startLiveSession: (id) => api.post(`/attendance/sessions/${id}/start-live`),
  declineSession: (id) => api.post(`/attendance/sessions/${id}/decline`),
  rejectSession: (id) => api.post(`/attendance/sessions/${id}/reject`),
  endSession: (id) => api.post(`/attendance/sessions/${id}/end`),
  logAttendance: (data) => api.post('/attendance/log', data),
  getHistory: (filters) => api.get('/attendance/history', { params: filters })
};

export const reportsAPI = {
  getStats: () => api.get('/reports/stats'),
  getDetailed: () => api.get('/reports/detailed')
};

export const adminAPI = {
  getMetadata: () => api.get('/admin/metadata'),
  addDepartment: (name) => api.post('/admin/departments', { name }),
  addClassroom: (name) => api.post('/admin/classrooms', { name }),
  addSubject: (name) => api.post('/admin/subjects', { name })
};

export default api;
