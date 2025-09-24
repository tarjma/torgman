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

// Build a safe WebSocket URL based on BASE_URL protocol
export function buildProjectWsUrl(projectId: string): string {
  try {
    const base = new URL(API_CONFIG.BASE_URL);
    const wsProtocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${base.host}${API_CONFIG.ENDPOINTS.WEBSOCKET}/${projectId}`;
  } catch {
    // Fallback: naive replace (kept for dev convenience)
    return `${API_CONFIG.BASE_URL.replace('http', 'ws')}${API_CONFIG.ENDPOINTS.WEBSOCKET}/${projectId}`;
  }
}
