import axios from 'axios';
import { API_CONFIG } from '../config/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const data = error.response?.data;
    if (data?.error === 'MODEL_OVERLOADED' || (error.response?.status === 503 && typeof data === 'object')) {
        // Attach user-friendly Arabic message
        error.userMessage = data?.message || 'النموذج مزدحم حالياً، يرجى المحاولة لاحقاً';
    }
    console.error('API Response Error:', data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
