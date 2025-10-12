export interface Subtitle {
  id: string;
  start_time: number;  // Changed from startTime to match backend
  end_time: number;    // Changed from endTime to match backend
  text: string;        // This represents both original and translated text
  originalText?: string;
  translatedText?: string;
  translation?: string; // Arabic translation from backend
  speaker_id?: string; // Added to match backend
  confidence?: number; // Added to match backend
  position: {
    x: number;
    y: number;
  };
  styling: SubtitleStyling;
}

// Keep backward compatibility with old naming
export interface LegacySubtitle {
  id: string;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText: string;
  position: {
    x: number;
    y: number;
  };
  styling: SubtitleStyling;
}

export interface SubtitleStyling {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  opacity: number;
  outline: boolean;
  outlineColor: string;
  bold: boolean;
  italic: boolean;
  alignment: 'right' | 'center' | 'left';
}

export interface VideoInfo {
  file?: File;
  url?: string;
  duration: number;
  title: string;
  language: string;
}

export interface AITranslation {
  original: string;
  translated: string;
  confidence: number;
  suggestions: string[];
  context?: string;
}

export interface ExportOptions {
  format: 'srt' | 'vtt';
  includeStyles: boolean;
  encoding: 'utf-8' | 'utf-16';
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  videoTitle: string;
  videoUrl?: string;
  videoFile?: string;
  subtitlesCount: number;
  duration: number;
<<<<<<< Updated upstream
  language: string;
  status: 'draft' | 'processing' | 'completed' | 'error'; // Updated to match backend
=======
  // Renamed backend field: source_language
  source_language?: string; // new preferred
  language?: string; // legacy fallback
  status: 'draft' | 'processing' | 'transcribed' | 'completed' | 'error' | 'failed';
  progress?: number; // 0-100, tracks processing progress
  currentStage?: string; // Current processing stage (e.g., "downloading_video", "generating_subtitles")
  stageMessage?: string; // User-friendly Arabic message for current stage
>>>>>>> Stashed changes
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  thumbnail?: string;
}

// Backend project data structure
export interface BackendProject {
  id: string;
  title: string;
  description?: string;
  youtube_url?: string;
  duration: number;
<<<<<<< Updated upstream
  status: 'draft' | 'processing' | 'completed' | 'error';
  language: string;
=======
  status: 'draft' | 'processing' | 'transcribed' | 'completed' | 'error' | 'failed';
  progress?: number;
  currentStage?: string;
  stageMessage?: string;
  source_language?: string; // new
  language?: string; // legacy
>>>>>>> Stashed changes
  subtitle_count: number;
  created_at?: string;
  updated_at?: string;
}