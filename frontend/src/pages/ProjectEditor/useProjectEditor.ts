/**
 * Custom hook for managing project editor state and logic
 * Extracts the complex state management from ProjectEditorPage
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Hooks
import { useProjects } from '../../hooks/useProjects';
import { useSubtitles } from '../../hooks/useSubtitles';
import { useVideoProcessor } from '../../hooks/useVideoProcessor';
import { useAITranslation } from '../../hooks/useAITranslation';
import { useProjectStatusUpdates } from '../../hooks/useProjectStatusUpdates';
import { useProjectSubtitleUpdates } from '../../hooks/useProjectSubtitleUpdates';
import { useSubtitlePolling } from '../../hooks/useSubtitlePolling';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useSubtitleConfig } from '../../hooks/useSubtitleConfig';

// Services
import { projectService, CaptionData } from '../../services/projectService';
import { wsManager } from '../../services/websocket';

// Types
import { Subtitle } from '../../types';
import { WebSocketMessage } from '../../types/websocket';

export interface ExportStatus {
  status: string;
  message: string;
  progress: number;
  data?: Record<string, unknown>;
}

export interface TranslationStatus {
  status: string;
  message: string;
  progress?: number;
}

export interface VideoInfo {
  url?: string;
  file?: File;
  duration?: number;
  title: string;
  language?: string;
  source_language?: string;
}

export interface UseProjectEditorReturn {
  // State
  projectId: string | null;
  project: Record<string, unknown> | null;
  isLoading: boolean;
  isAutoSaving: boolean;
  isRetranscribing: boolean;
  translationStatus: TranslationStatus | null;
  exportStatus: ExportStatus | null;
  videoInfo: VideoInfo | null;
  
  // Subtitle state
  subtitles: Subtitle[];
  activeSubtitle: string | null;
  currentTime: number;
  
  // Subtitle config
  subtitleConfig: Record<string, unknown> | null;
  
  // Translation
  isTranslating: boolean;
  
  // Actions
  setActiveSubtitle: (id: string | null) => void;
  setCurrentTime: (time: number) => void;
  addSubtitle: (startTime: number, endTime: number, text?: string) => string;
  updateSubtitle: (id: string, updates: Partial<Subtitle>) => void;
  deleteSubtitle: (id: string) => void;
  duplicateSubtitle: (id: string) => void;
  loadSubtitles: (subtitles: Subtitle[]) => void;
  clearSubtitles: () => void;
  
  // Navigation
  findNextSubtitle: () => Subtitle | undefined;
  findPreviousSubtitle: () => Subtitle | undefined;
  seekToSubtitle: (id: string) => number | null;
  getSubtitleByTime: (time: number) => Subtitle | undefined;
  
  // Handlers
  handleBackToHome: () => void;
  handleTranslateText: (text: string) => Promise<string>;
  handleRetranscribe: (language: string) => Promise<void>;
  handleSeekToSubtitle: (startTime: number, subtitleId: string) => void;
  handleRegenerateCaptionsSuccess: () => Promise<void>;
  handleExportSubtitles: () => void;
  handleExportVideo: () => Promise<void>;
  handleTimeUpdate: (time: number) => void;
  
  // Auto-save
  triggerAutoSave: () => void;
  saveNow: (() => void) | undefined;
  
  // Modal controls
  showGlobalSettings: boolean;
  setShowGlobalSettings: (show: boolean) => void;
  showRegenerateCaptions: boolean;
  setShowRegenerateCaptions: (show: boolean) => void;
  showRetranscribe: boolean;
  setShowRetranscribe: (show: boolean) => void;
  
  // Export status setter for WebSocket updates
  setExportStatus: (status: ExportStatus | null) => void;
}

// Default subtitle styling
const defaultSubtitleStyling = {
  fontFamily: 'Noto Sans Arabic, Arial, sans-serif',
  fontSize: 20,
  color: '#ffffff',
  backgroundColor: '#000000',
  opacity: 1,
  outline: true,
  outlineColor: '#000000',
  bold: false,
  italic: false,
  alignment: 'center' as const,
};

/**
 * Convert backend subtitle format to frontend format
 */
function convertBackendSubtitles(
  backendSubtitles: CaptionData[],
  projectId: string
): Subtitle[] {
  return backendSubtitles.map((sub, index) => ({
    id: `${projectId}-${index}`,
    start_time: sub.start_time || sub.start || 0,
    end_time: sub.end_time || sub.end || 0,
    text: sub.text,
    originalText: sub.text,
    translatedText: sub.translation || '',
    position: { x: 50, y: 80 },
    styling: { ...defaultSubtitleStyling },
  }));
}

export function useProjectEditor(): UseProjectEditorReturn {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Validate that the projectId parameter is actually a project (starts with "project_")
  const projectId = paramProjectId?.startsWith('project_') ? paramProjectId : null;

  // Local state
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [showRegenerateCaptions, setShowRegenerateCaptions] = useState(false);
  const [showRetranscribe, setShowRetranscribe] = useState(false);
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [project, setProject] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Projects management
  const defaultUserId = 'local-user';
  const {
    projects,
    updateProjectFromWebSocket,
    isLoading: projectsLoading,
  } = useProjects(defaultUserId);

  // Wrapper to match the ProjectProcessingUpdateHandler signature
  const handleProjectUpdate = useCallback(
    (projectId: string, updates: Record<string, unknown>) => {
      updateProjectFromWebSocket(projectId, updates);
    },
    [updateProjectFromWebSocket]
  );

  // Set up real-time project status updates
  useProjectStatusUpdates(projects, handleProjectUpdate);

  // Subtitle hooks
  const {
    subtitles,
    activeSubtitle,
    setActiveSubtitle,
    currentTime,
    setCurrentTime,
    addSubtitle,
    updateSubtitle,
    deleteSubtitle,
    duplicateSubtitle,
    loadSubtitles,
    clearSubtitles,
    findNextSubtitle,
    findPreviousSubtitle,
    seekToSubtitle,
    getSubtitleByTime,
  } = useSubtitles();

  const { videoInfo, setVideoInfo } = useVideoProcessor();

  const { isTranslating, translateText } = useAITranslation();

  const { config: subtitleConfig } = useSubtitleConfig();

  // Set up real-time subtitle updates for the current project
  useProjectSubtitleUpdates(
    projectId,
    (updatedSubtitles) => {
      console.log('Received subtitle update:', updatedSubtitles);
      loadSubtitles(updatedSubtitles);
    },
    (status, message) => {
      console.log('Received status update:', status, message);
      setTranslationStatus({ status, message });

      if (status === 'completed' || status === 'completion') {
        setTimeout(() => {
          alert(message);
          setTranslationStatus(null);
        }, 500);
      } else if (status === 'failed' || status === 'error') {
        alert(`خطأ: ${message}`);
        setTranslationStatus(null);
      }
    }
  );

  // Set up polling as fallback for subtitle updates during translation
  useSubtitlePolling(
    projectId,
    translationStatus?.status === 'translating' || false,
    (polledSubtitles) => {
      console.log('Received polled subtitle update:', polledSubtitles);
      loadSubtitles(polledSubtitles);
    }
  );

  // Load project data when component mounts
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        navigate('/');
        return;
      }

      if (projectsLoading) {
        return;
      }

      try {
        setIsLoading(true);

        const foundProject = projects.find((p) => p.id === projectId);
        if (!foundProject) {
          try {
            console.log('Project not found in list, trying to load directly from backend...');
            await projectService.getProjectSubtitles(projectId);
            console.log('Project exists in backend, continuing...');
          } catch {
            console.error('Project not found in backend either');
            alert('المشروع غير موجود');
            navigate('/');
            return;
          }
        }

        if (
          foundProject &&
          foundProject.status !== 'transcribed' &&
          foundProject.status !== 'completed'
        ) {
          alert(`المشروع لا يزال قيد المعالجة. الحالة: ${foundProject.status}`);
          navigate('/');
          return;
        }

        setProject(foundProject as unknown as Record<string, unknown>);

        // Load subtitles from backend
        const backendSubtitles = await projectService.getProjectSubtitles(projectId);
        const frontendSubtitles = convertBackendSubtitles(backendSubtitles, projectId);
        loadSubtitles(frontendSubtitles);

        // Get source language from project (may be on the extended project data)
        const projectAny = foundProject as Record<string, unknown> | undefined;
        const sourceLanguage = (projectAny?.source_language as string) || foundProject?.language || 'en';

        // Load video
        if (foundProject?.videoUrl) {
          const videoUrl = await projectService.getProjectVideo(projectId);
          setVideoInfo({
            url: videoUrl,
            duration: foundProject.duration,
            title: foundProject.videoTitle || foundProject.title,
            language: 'ar',
            source_language: sourceLanguage,
          });
        } else if (foundProject?.videoFile) {
          setVideoInfo({
            url: `/api/projects/${projectId}/video`,
            title: foundProject.videoTitle || foundProject.title,
            duration: foundProject.duration,
            language: 'ar',
            source_language: sourceLanguage,
          });
        } else {
          try {
            const videoUrl = await projectService.getProjectVideo(projectId);
            setVideoInfo({
              url: videoUrl,
              duration: 0,
              title: `Project ${projectId}`,
              language: 'ar',
            });
          } catch (error) {
            console.error('Failed to load video:', error);
          }
        }
      } catch (error) {
        console.error('Error loading project:', error);
        alert('فشل في تحميل المشروع. يرجى المحاولة مرة أخرى.');
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId, projects, projectsLoading, navigate, loadSubtitles, setVideoInfo]);

  // Auto-save functionality
  const { triggerAutoSave, saveNow } = useAutoSave({
    projectId,
    subtitles,
    onSaveStart: () => setIsAutoSaving(true),
    onSaveComplete: () => setTimeout(() => setIsAutoSaving(false), 1000),
    onSaveError: (error) => {
      setIsAutoSaving(false);
      console.error('Auto-save error:', error);
    },
    debounceMs: 2000,
  });

  // Handlers
  const handleBackToHome = useCallback(() => {
    clearSubtitles();
    wsManager.reset();
    navigate('/');
  }, [clearSubtitles, navigate]);

  const handleTranslateText = useCallback(
    async (text: string): Promise<string> => {
      const result = await translateText(text);
      return result.translated;
    },
    [translateText]
  );

  const handleRetranscribe = useCallback(
    async (language: string) => {
      if (!projectId) return;

      try {
        setIsRetranscribing(true);
        setShowRetranscribe(false);

        await projectService.retranscribeProject(
          projectId,
          language !== 'auto' ? language : undefined
        );

        alert('بدأت عملية إعادة التوليد. سيتم تحديث الترجمات تلقائياً عند الانتهاء.');
      } catch (error) {
        console.error('Retranscribe failed:', error);
        alert(
          `فشل في بدء عملية إعادة التوليد: ${
            error instanceof Error ? error.message : 'خطأ غير معروف'
          }`
        );
        setIsRetranscribing(false);
      }
    },
    [projectId]
  );

  const handleSeekToSubtitle = useCallback(
    (startTime: number, subtitleId: string) => {
      setCurrentTime(startTime);
      setActiveSubtitle(subtitleId);
    },
    [setCurrentTime, setActiveSubtitle]
  );

  const handleRegenerateCaptionsSuccess = useCallback(async () => {
    if (!projectId) return;

    const backendSubtitles = await projectService.getProjectSubtitles(projectId);
    const frontendSubtitles = convertBackendSubtitles(backendSubtitles, projectId);
    loadSubtitles(frontendSubtitles);
    alert('تم إعادة إنشاء الترجمات بنجاح!');
  }, [projectId, loadSubtitles]);

  const handleExportSubtitles = useCallback(() => {
    if (subtitles.length === 0) {
      alert('لا توجد ترجمات للتصدير');
      return;
    }

    // Import dynamically to avoid circular dependencies
    import('../../utils/exportUtils').then(({ exportSubtitles, downloadFile }) => {
      const exportOptions = {
        format: 'srt' as const,
        includeStyles: false,
        encoding: 'utf-8' as const,
      };

      const content = exportSubtitles(subtitles, exportOptions);
      const filename = `${videoInfo?.title || 'subtitles'}_arabic.${exportOptions.format}`;
      const mimeType = 'text/srt';

      downloadFile(content, filename, mimeType);
    });
  }, [subtitles, videoInfo]);

  const handleExportVideo = useCallback(async () => {
    if (!projectId || !subtitleConfig) {
      alert('لم يتم تحميل بيانات المشروع أو إعدادات الترجمة بعد.');
      return;
    }

    if (exportStatus && !['export_completed', 'export_failed'].includes(exportStatus.status)) {
      alert('عملية تصدير أخرى قيد التنفيذ بالفعل.');
      return;
    }

    const confirmExport = confirm(
      'سيتم دمج الترجمة في الفيديو بشكل دائم. قد تستغرق هذه العملية بعض الوقت. هل تريد المتابعة؟'
    );
    if (!confirmExport) return;

    try {
      setExportStatus({ status: 'starting', message: 'بدء عملية التصدير...', progress: 0 });
      await projectService.exportProjectVideo(projectId, subtitleConfig);
    } catch (error) {
      console.error('Failed to start video export:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`فشل في بدء عملية تصدير الفيديو: ${errorMessage}`);
      setExportStatus(null);
    }
  }, [projectId, subtitleConfig, exportStatus]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time);
      const currentSub = getSubtitleByTime(time);
      if (currentSub && currentSub.id !== activeSubtitle) {
        setActiveSubtitle(currentSub.id);
      } else if (!currentSub && activeSubtitle) {
        setActiveSubtitle(null);
      }
    },
    [setCurrentTime, getSubtitleByTime, activeSubtitle, setActiveSubtitle]
  );

  // Listen for retranscription status updates via WebSocket
  useEffect(() => {
    if (!projectId) return;

    const handleRetranscribeMessage = (message: WebSocketMessage) => {
      if (message.project_id !== projectId) return;

      if (message.type === 'status') {
        if (message.status === 'retranscribing') {
          console.log('Retranscription in progress:', message.message);
        } else if (message.status === 'retranscribe_completed') {
          setIsRetranscribing(false);
          alert(message.message || 'تم إعادة توليد الترجمات بنجاح!');
          window.location.reload();
        } else if (message.status === 'retranscribe_failed') {
          setIsRetranscribing(false);
          alert(message.message || 'فشلت عملية إعادة التوليد');
        }
      }
    };

    wsManager.addEventListener(projectId, handleRetranscribeMessage);

    return () => {
      wsManager.removeEventListener(projectId, handleRetranscribeMessage);
    };
  }, [projectId]);

  return {
    // State
    projectId,
    project,
    isLoading,
    isAutoSaving,
    isRetranscribing,
    translationStatus,
    exportStatus,
    videoInfo: videoInfo as VideoInfo | null,

    // Subtitle state
    subtitles,
    activeSubtitle,
    currentTime,

    // Subtitle config
    subtitleConfig: subtitleConfig as Record<string, unknown> | null,

    // Translation
    isTranslating,

    // Actions
    setActiveSubtitle,
    setCurrentTime,
    addSubtitle,
    updateSubtitle,
    deleteSubtitle,
    duplicateSubtitle,
    loadSubtitles,
    clearSubtitles,

    // Navigation
    findNextSubtitle,
    findPreviousSubtitle,
    seekToSubtitle,
    getSubtitleByTime,

    // Handlers
    handleBackToHome,
    handleTranslateText,
    handleRetranscribe,
    handleSeekToSubtitle,
    handleRegenerateCaptionsSuccess,
    handleExportSubtitles,
    handleExportVideo,
    handleTimeUpdate,

    // Auto-save
    triggerAutoSave,
    saveNow,

    // Modal controls
    showGlobalSettings,
    setShowGlobalSettings,
    showRegenerateCaptions,
    setShowRegenerateCaptions,
    showRetranscribe,
    setShowRetranscribe,

    // Export status setter
    setExportStatus,
  };
}
