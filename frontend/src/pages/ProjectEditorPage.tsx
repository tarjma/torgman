import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Languages } from 'lucide-react';

// Components
import VideoPlayer from '../components/VideoPlayer';
import IntegratedSubtitlePanel from '../components/IntegratedSubtitlePanel';
import VideoPlayerHeader from '../components/VideoPlayerHeader';
import GlobalSubtitleSettings from '../components/GlobalSubtitleSettings';
import VideoExportModal from '../components/VideoExportModal';

// Hooks
import { useProjects } from '../hooks/useProjects';
import { useSubtitles } from '../hooks/useSubtitles';
import { useVideoProcessor } from '../hooks/useVideoProcessor';
import { useAITranslation } from '../hooks/useAITranslation';
import { useProjectStatusUpdates } from '../hooks/useProjectStatusUpdates';
import { useProjectSubtitleUpdates } from '../hooks/useProjectSubtitleUpdates';
import { useSubtitlePolling } from '../hooks/useSubtitlePolling';
import { useAutoSave } from '../hooks/useAutoSave';

// Services
import { projectService } from '../services/projectService';
import { webSocketService } from '../services/webSocketService';

// Utils  
import { exportSubtitles, downloadFile } from '../utils/exportUtils';

const ProjectEditorPage = () => {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  // Validate that the projectId parameter is actually a project (starts with "project_")
  const projectId = paramProjectId?.startsWith('project_') ? paramProjectId : null;
  
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [showVideoExportModal, setShowVideoExportModal] = useState(false);
  const [translationStatus, setTranslationStatus] = useState<{ status: string; message: string; progress?: number } | null>(null);
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ref for the video container for fullscreen functionality
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Projects management
  const defaultUserId = 'local-user';
  const { 
    projects, 
    updateProjectFromWebSocket,
    isLoading: projectsLoading
  } = useProjects(defaultUserId);

  // Set up real-time project status updates
  useProjectStatusUpdates(projects, updateProjectFromWebSocket);

  // Set up real-time subtitle updates for the current project
  useProjectSubtitleUpdates(
    projectId || null, 
    (subtitles) => {
      console.log('Received subtitle update:', subtitles);
      loadSubtitles(subtitles);
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
      } else if (status === 'translating') {
        console.log('Translation in progress:', message);
      }
    }
  );

  // Set up polling as fallback for subtitle updates during translation
  useSubtitlePolling(
    projectId || null,
    translationStatus?.status === 'translating' || false,
    (subtitles) => {
      console.log('Received polled subtitle update:', subtitles);
      loadSubtitles(subtitles);
    }
  );

  // Editor hooks
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
    // Navigation functions
    findNextSubtitle,
    findPreviousSubtitle,
    seekToSubtitle,
    getSubtitleByTime
  } = useSubtitles();

  const {
    videoInfo,
    setVideoInfo
  } = useVideoProcessor();

  const {
    isTranslating,
    translateText
  } = useAITranslation();

  // Load project data when component mounts
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        navigate('/');
        return;
      }

      // Wait for projects to load first
      if (projectsLoading) {
        return;
      }

      try {
        setIsLoading(true);
        
        // Find project in the projects list
        const foundProject = projects.find(p => p.id === projectId);
        if (!foundProject) {
          // Try to load the project directly from the backend first
          try {
            console.log('Project not found in list, trying to load directly from backend...');
            await projectService.getProjectSubtitles(projectId);
            // If we can load subtitles, the project exists
            console.log('Project exists in backend, continuing...');
          } catch (error) {
            console.error('Project not found in backend either:', error);
            alert('المشروع غير موجود');
            navigate('/');
            return;
          }
        }

        if (foundProject && foundProject.status !== 'completed') {
          alert(`المشروع لا يزال قيد المعالجة. الحالة: ${foundProject.status}`);
          navigate('/');
          return;
        }

        setProject(foundProject);

        // Load subtitles from backend
        console.log('Loading subtitles for project:', projectId);
        const backendSubtitles = await projectService.getProjectSubtitles(projectId);
        console.log('Backend subtitles received:', backendSubtitles);
        
        // Convert backend subtitles to frontend format
        const frontendSubtitles = backendSubtitles.map((sub, index) => ({
          id: `${projectId}-${index}`,
          start_time: sub.start,
          end_time: sub.end,
          text: sub.text,
          originalText: sub.text,
          translatedText: sub.translation || '',
          position: { x: 50, y: 80 },
          styling: {
            fontFamily: 'Noto Sans Arabic, Arial, sans-serif',
            fontSize: 20,
            color: '#ffffff',
            backgroundColor: '#000000',
            opacity: 1,
            outline: true,
            outlineColor: '#000000',
            bold: false,
            italic: false,
            alignment: 'center' as const
          }
        }));
        
        console.log('Frontend subtitles converted:', frontendSubtitles);
        loadSubtitles(frontendSubtitles);
        
        // Load video - handle case where foundProject might be undefined
        if (foundProject?.videoUrl) {
          const videoUrl = await projectService.getProjectVideo(projectId);
          setVideoInfo({
            url: videoUrl,
            duration: foundProject.duration,
            title: foundProject.videoTitle,
            language: foundProject.language || 'ar'
          });
        } else if (foundProject?.videoFile) {
          setVideoInfo({
            url: `/api/projects/${projectId}/video`,
            title: foundProject.videoTitle,
            duration: foundProject.duration,
            language: foundProject.language || 'ar'
          });
        } else {
          // Try to load video URL directly even if project not in list
          try {
            const videoUrl = await projectService.getProjectVideo(projectId);
            setVideoInfo({
              url: videoUrl,
              duration: 0, // Will be updated when video loads
              title: `Project ${projectId}`,
              language: 'ar'
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
    onSaveStart: () => {
      setIsAutoSaving(true);
    },
    onSaveComplete: () => {
      setTimeout(() => setIsAutoSaving(false), 1000); // Show saved indicator for 1 second
    },
    onSaveError: (error) => {
      setIsAutoSaving(false);
      console.error('Auto-save error:', error);
      // Optionally show error notification to user
    },
    debounceMs: 2000 // Save 2 seconds after last edit
  });

  // Keyboard shortcuts
  useHotkeys('space', (e) => {
    e.preventDefault();
  });

  useHotkeys('ctrl+s', (e) => {
    e.preventDefault();
    triggerAutoSave();
    if (saveNow) {
      saveNow(); // Immediate save on Ctrl+S
    }
  });

  useHotkeys('ctrl+n', (e) => {
    e.preventDefault();
    addSubtitle(currentTime, currentTime + 3);
  });

  // Handlers
  const handleBackToHome = useCallback(() => {
    clearSubtitles();
    webSocketService.reset();
    navigate('/');
  }, [clearSubtitles, navigate]);

  const handleTranslateText = useCallback(async (text: string) => {
    try {
      const translation = await translateText(text);
      const subtitle = subtitles.find(s => 
        s.originalText === text || 
        s.text === text || 
        (s.originalText || s.text) === text
      );
      if (subtitle) {
        updateSubtitle(subtitle.id, { translatedText: translation.translated });
      } else {
        console.warn('Could not find subtitle to update with translation:', text);
      }
    } catch (error) {
      console.error('Translation failed:', error);
      throw error;
    }
  }, [translateText, subtitles, updateSubtitle]);

  const handleSeekToSubtitle = useCallback((startTime: number, subtitleId: string) => {
    setCurrentTime(startTime);
    setActiveSubtitle(subtitleId);
  }, [setCurrentTime, setActiveSubtitle]);

  const handleExportSubtitles = useCallback(() => {
    if (subtitles.length === 0) {
      alert('لا توجد ترجمات للتصدير');
      return;
    }

    const exportOptions = {
      format: 'srt' as const,
      includeStyles: false,
      encoding: 'utf-8' as const
    };

    const content = exportSubtitles(subtitles, exportOptions);
    const filename = `${videoInfo?.title || 'subtitles'}_arabic.${exportOptions.format}`;
    const mimeType = 'text/srt';
    
    downloadFile(content, filename, mimeType);
  }, [subtitles, videoInfo]);

  const handleVideoExport = useCallback(() => {
    if (subtitles.length === 0) {
      alert('لا توجد ترجمات لإضافتها إلى الفيديو');
      return;
    }
    setShowVideoExportModal(true);
  }, [subtitles]);

  // Auto-update active subtitle based on current time
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
    const currentSub = getSubtitleByTime(time);
    if (currentSub && currentSub.id !== activeSubtitle) {
      setActiveSubtitle(currentSub.id);
    } else if (!currentSub && activeSubtitle) {
      setActiveSubtitle(null);
    }
  }, [setCurrentTime, getSubtitleByTime, activeSubtitle, setActiveSubtitle]);

  // Keyboard shortcuts for navigation
  useHotkeys('left', () => {
    const prevSub = findPreviousSubtitle();
    if (prevSub) {
      seekToSubtitle(prevSub.id);
    }
  }, [findPreviousSubtitle, seekToSubtitle]);

  useHotkeys('right', () => {
    const nextSub = findNextSubtitle();
    if (nextSub) {
      seekToSubtitle(nextSub.id);
    }
  }, [findNextSubtitle, seekToSubtitle]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center overflow-hidden" dir="rtl">
        <div className="text-center max-w-md">
          <button
            onClick={handleBackToHome}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 transition-colors"
          >
            ← العودة إلى الصفحة الرئيسية
          </button>
          
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Languages className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            جاري تحميل المشروع...
          </h2>
          <p className="text-gray-600">
            يتم تحميل الفيديو والترجمات
          </p>
        </div>
      </div>
    );
  }

  // Show message if no video is loaded yet
  if (!videoInfo) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center overflow-hidden" dir="rtl">
        <div className="text-center max-w-md">
          <button
            onClick={handleBackToHome}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 transition-colors"
          >
            ← العودة إلى الصفحة الرئيسية
          </button>
          
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Languages className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            جاري تحضير المشروع...
          </h2>
          <p className="text-gray-600">
            يتم معالجة الفيديو وإعداد بيئة الترجمة
          </p>
        </div>
      </div>
    );
  }

  // Editor mode with video loaded - Full viewport height layout
  return (
    <div className="h-screen bg-gray-50 relative flex flex-col overflow-hidden" dir="rtl">
      {/* Header - Fixed height */}
      <div className="flex-shrink-0">
        <VideoPlayerHeader
          projectTitle={project?.title || 'مشروع جديد'}
          videoTitle={videoInfo.title}
          currentTime={currentTime}
          duration={videoInfo.duration || 0}
          subtitleCount={subtitles.length}
          onBackToHome={handleBackToHome}
          onShowGlobalSettings={() => setShowGlobalSettings(true)}
          onExport={handleExportSubtitles}
          onVideoExport={handleVideoExport}
        />
      </div>
      
      {/* Main Content - Takes remaining height, no scrolling */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Subtitle Panel - Fixed width, internal scrolling only */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
          <IntegratedSubtitlePanel
            subtitles={subtitles}
            activeSubtitle={activeSubtitle}
            currentTime={currentTime}
            videoTitle={videoInfo.title}
            projectId={projectId || undefined}
            translationStatus={translationStatus}
            onAddSubtitle={(startTime, endTime) => {
              console.log('Adding subtitle:', { startTime, endTime });
              return addSubtitle(startTime, endTime);
            }}
            onUpdateSubtitle={(id, updates) => {
              console.log('Updating subtitle:', { id, updates });
              updateSubtitle(id, updates);
            }}
            onDeleteSubtitle={deleteSubtitle}
            onSelectSubtitle={setActiveSubtitle}
            onDuplicateSubtitle={duplicateSubtitle}
            onTranslateText={handleTranslateText}
            onSeekToSubtitle={handleSeekToSubtitle}
            isTranslating={isTranslating}
            isAutoSaving={isAutoSaving}
            onTriggerAutoSave={triggerAutoSave}
          />
        </div>

        {/* Video Player - Takes remaining width, no scrolling */}
        <div className="flex-1 bg-black relative overflow-hidden" ref={videoContainerRef}>
          <VideoPlayer
            videoFile={videoInfo.file}
            videoSrc={videoInfo.url}
            subtitles={subtitles}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={(duration) => console.log('Duration:', duration)}
          />
        </div>
      </div>

      {/* Global Subtitle Settings Modal */}
      <GlobalSubtitleSettings
        isOpen={showGlobalSettings}
        onClose={() => setShowGlobalSettings(false)}
      />

      {/* Video Export Modal */}
      {projectId && (
        <VideoExportModal
          isOpen={showVideoExportModal}
          onClose={() => setShowVideoExportModal(false)}
          projectId={projectId}
          projectTitle={project?.title || videoInfo.title || 'مشروع جديد'}
          subtitles={subtitles}
        />
      )}
    </div>
  );
};

export default ProjectEditorPage;
