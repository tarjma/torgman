/**
 * Index file for WebSocket services
 * Provides backward-compatible exports while using the unified WebSocketManager
 */

export { wsManager, WebSocketManager } from './WebSocketManager';

// Re-export types
export type { WebSocketEventHandler, WebSocketMessage } from '../../types/websocket';
