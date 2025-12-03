/**
 * Project Editor Page
 * 
 * Main editor interface for editing subtitles on a video project.
 * Uses the useProjectEditor hook for state management.
 */

import { useRef, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Languages, Loader2 } from 'lucide-react';

// Components
import VideoPlayer from '../../components/VideoPlayer';
import IntegratedSubtitlePanel from '../../components/IntegratedSubtitlePanel';
import VideoPlayerHeader from '../../components/VideoPlayerHeader';
import RegenerateCaptionsModal from '../../components/RegenerateCaptionsModal';
import RetranscribeModal from '../../components/RetranscribeModal';

// Services
import { wsManager } from '../../services/websocket';

// Hook
import { useProjectEditor } from './useProjectEditor';

const ProjectEditorPage = () => {
  const {
    // State
    projectId,
    project,
    isLoading,
    isAutoSaving,
    isRetranscribing,
    translationStatus,
    exportStatus,
    videoInfo,
    
    // Subtitle state
    subtitles,
    activeSubtitle,
    currentTime,
    
    // Translation
    isTranslating,
    
    // Actions
    setActiveSubtitle,
    addSubtitle,
    updateSubtitle,
    deleteSubtitle,
    duplicateSubtitle,
    
    // Navigation
    findNextSubtitle,
    findPreviousSubtitle,
    seekToSubtitle,
    
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
    showRegenerateCaptions,
    setShowRegenerateCaptions,
    showRetranscribe,
    setShowRetranscribe,
    
    // Export status setter
    setExportStatus,
  } = useProjectEditor();

  // Ref for the video container for fullscreen functionality
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  useHotkeys('space', (e) => {
    e.preventDefault();
  });

  useHotkeys('ctrl+s', (e) => {
    e.preventDefault();
    triggerAutoSave();
    if (saveNow) {
      saveNow();
    }
  });

  useHotkeys('ctrl+n', (e) => {
    e.preventDefault();
    addSubtitle(currentTime, currentTime + 3);
  });

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

  // WebSocket message handler for export status updates
  useEffect(() => {
    if (!projectId) return;

    const handleExportMessage = (message: { project_id: string; type: string; status?: string; message?: string; progress?: number; data?: Record<string, unknown> }) => {
      if (message.project_id !== projectId) return;

      if (message.type === 'export_status') {
        const { status, message: msg, progress = 0, data } = message;

        setExportStatus({
          status: status || 'processing',
          message: (msg as string) || 'جاري معالجة التصدير...',
          progress: typeof progress === 'number' ? progress : 0,
          ...(data ? { data } : {}),
        });

        if (status === 'export_completed' && data?.download_url) {
          const downloadUrl = `${window.location.origin}${data.download_url}`;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = (data.filename as string) || 'exported_video.mp4';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setExportStatus({
            status: 'export_completed',
            message: 'تم تصدير الفيديو بنجاح! جاري التحميل...',
            progress: 100,
            data,
          });

          setTimeout(() => setExportStatus(null), 5000);
        } else if (status === 'export_failed') {
          alert(`فشل تصدير الفيديو: ${msg}`);
          setExportStatus(null);
        }
      }
    };

    wsManager.addEventListener('*', handleExportMessage);

    return () => {
      wsManager.removeEventListener('*', handleExportMessage);
    };
  }, [projectId, setExportStatus]);

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

  // Editor mode with video loaded
  return (
    <div className="h-screen bg-gray-50 relative flex flex-col overflow-hidden" dir="rtl">
      {/* Export overlay */}
      {exportStatus && !['export_completed', 'export_failed'].includes(exportStatus.status) && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-[100] text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <h2 className="text-2xl font-bold mb-2">جاري تصدير الفيديو...</h2>
          <p className="mb-4">{exportStatus.message}</p>
          <div className="w-80 bg-gray-600 rounded-full h-2.5">
            <div 
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${exportStatus.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0">
        <VideoPlayerHeader
          projectTitle={(project?.title as string) || 'مشروع جديد'}
          videoTitle={videoInfo.title}
          currentTime={currentTime}
          duration={videoInfo.duration || 0}
          subtitleCount={subtitles.length}
          isExporting={!!(exportStatus && !['export_completed', 'export_failed'].includes(exportStatus.status))}
          onBackToHome={handleBackToHome}
          onRegenerateCaptions={() => setShowRegenerateCaptions(true)}
          onRetranscribe={() => setShowRetranscribe(true)}
          onExport={handleExportSubtitles}
          onExportVideo={handleExportVideo}
        />
      </div>
      
      {/* Main Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Subtitle Panel */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
          <IntegratedSubtitlePanel
            subtitles={subtitles}
            activeSubtitle={activeSubtitle}
            currentTime={currentTime}
            videoTitle={videoInfo.title}
            projectId={projectId || undefined}
            translationStatus={translationStatus}
            onAddSubtitle={(startTime, endTime) => addSubtitle(startTime, endTime)}
            onUpdateSubtitle={(id, updates) => updateSubtitle(id, updates)}
            onDeleteSubtitle={deleteSubtitle}
            onSelectSubtitle={setActiveSubtitle}
            onDuplicateSubtitle={duplicateSubtitle}
            onTranslateText={async (text) => { await handleTranslateText(text); }}
            onSeekToSubtitle={handleSeekToSubtitle}
            isTranslating={isTranslating}
            isAutoSaving={isAutoSaving}
            onTriggerAutoSave={triggerAutoSave}
          />
        </div>

        {/* Video Player */}
        <div className="flex-1 bg-black relative overflow-hidden" ref={videoContainerRef}>
          <VideoPlayer
            videoFile={videoInfo.file}
            videoSrc={videoInfo.url}
            subtitles={subtitles}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={() => {}}
            sourceLangCode={
              (project?.source_language as string) || 
              (project?.language as string) || 
              videoInfo.source_language
            }
          />
        </div>
      </div>

      {/* Modals */}
      <RegenerateCaptionsModal
        isOpen={showRegenerateCaptions}
        onClose={() => setShowRegenerateCaptions(false)}
        projectId={projectId || ''}
        onSuccess={handleRegenerateCaptionsSuccess}
      />

      <RetranscribeModal
        isOpen={showRetranscribe}
        onClose={() => setShowRetranscribe(false)}
        onRetranscribe={handleRetranscribe}
        isProcessing={isRetranscribing}
        currentLanguage={videoInfo?.source_language}
      />
    </div>
  );
};

export default ProjectEditorPage;
