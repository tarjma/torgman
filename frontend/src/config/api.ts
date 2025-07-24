// API configuration and endpoints
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  ENDPOINTS: {
    HEALTH: '/api/health',
    YOUTUBE_INFO: '/api/youtube/info',
    YOUTUBE_PROCESS: '/api/youtube/process', 
    PROJECTS: '/api/projects',
    PROJECTS_UPLOAD: '/api/projects/upload',
    FONTS: '/api/fonts',
    WEBSOCKET: '/ws'
  }
} as const;

// WebSocket connection configuration
export const WS_CONFIG = {
  RECONNECT_INTERVAL: 2000, // Faster reconnection for better reliability
  MAX_RECONNECT_ATTEMPTS: 10 // More attempts for long-running operations
} as const;
