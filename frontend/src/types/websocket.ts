// Shared WebSocket event and message types

export type WebSocketEventType =
  | 'status'
  | 'subtitles'
  | 'error'
  | 'heartbeat'
  | 'completion'
  | 'translating'
  | 'pong'
  | 'export_status';

export type WebSocketStatus =
  | 'downloading_audio'
  | 'downloading_video'
  | 'downloading_thumbnail'
  | 'extracting_audio'
  | 'processing_audio'
  | 'generating_subtitles'
  | 'saving_data'
  | 'transcribed'
  | 'completed'
  | 'translating'
  | 'export_started'
  | 'generating_clips'
  | 'compositing_video'
  | 'export_completed'
  | 'export_failed';

export interface WebSocketMessage {
  project_id: string;
  type: WebSocketEventType;
  status?: WebSocketStatus;
  progress?: number;
  message?: string;
  data?: any;
  filename?: string;
  file_size?: number;
  download_url?: string;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;
