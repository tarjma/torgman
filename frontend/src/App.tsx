import { useState, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Languages, Keyboard } from 'lucide-react';

// Components
import HomePage from './components/HomePage';
import CreateProjectModal from './components/CreateProjectModal';
import VideoPlayer from './components/VideoPlayer';
import IntegratedSubtitlePanel from './components/IntegratedSubtitlePanel';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useProjects } from './hooks/useProjects';
import { useSubtitles } from './hooks/useSubtitles';
import { useVideoProcessor } from './hooks/useVideoProcessor';
import { useAITranslation } from './hooks/useAITranslation';

// Types
import { Project } from './types';

type AppMode = 'home' | 'editor';

function App() {
  const [appMode, setAppMode] = useState<AppMode>('home');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Authentication
  const { user, isLoading: authLoading } = useAuth();

  // Projects management
  const { 
    projects, 
    createProject, 
    deleteProject 
  } = useProjects(user?.id);

  // Editor hooks (only used in editor mode)
  const {
    subtitles,
    activeSubtitle,
    setActiveSubtitle,
    currentTime,
    setCurrentTime,
    addSubtitle,
    updateSubtitle,
    deleteSubtitle,
    duplicateSubtitle
  } = useSubtitles();

  const {
    videoInfo,
    isProcessing,
    progress,
    processVideoFile,
    processYouTubeUrl,
    setVideoInfo,
    extractYouTubeTitle
  } = useVideoProcessor();

  const {
    isTranslating,
    translateText
  } = useAITranslation();

  // Auto-save functionality
  const triggerAutoSave = useCallback(() => {
    setIsAutoSaving(true);
    setTimeout(() => setIsAutoSaving(false), 1000);
  }, []);

  // Keyboard shortcuts (only in editor mode)
  useHotkeys('space', (e) => {
    if (appMode === 'editor') {
      e.preventDefault();
    }
  });

  useHotkeys('ctrl+s', (e) => {
    if (appMode === 'editor') {
      e.preventDefault();
      triggerAutoSave();
    }
  });

  useHotkeys('ctrl+n', (e) => {
    if (appMode === 'editor') {
      e.preventDefault();
      addSubtitle(currentTime, currentTime + 3);
    }
  });

  // Handlers
  const handleCreateProject = useCallback(async (
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, 
    videoFile?: File, 
    youtubeUrl?: string,
    resolution?: string
  ) => {
    try {
      // Process video first
      let videoProcessingResult = null;
      if (videoFile) {
        videoProcessingResult = await processVideoFile(videoFile);
      } else if (youtubeUrl) {
        videoProcessingResult = await processYouTubeUrl(youtubeUrl);
      }

      // Create project with video info and resolution
      const newProject = await createProject({
        ...projectData,
        duration: videoProcessingResult?.duration || 0
      }, resolution || '720p');

      if (newProject) {
        setCurrentProject(newProject);
        setShowCreateModal(false);
        setAppMode('editor');
      }
    } catch (error) {
      console.error('Project creation failed:', error);
      alert('فشل في إنشاء المشروع');
    }
  }, [createProject, processVideoFile, processYouTubeUrl]);

  const handleOpenProject = useCallback((project: Project) => {
    setCurrentProject(project);
    // Reset video info when opening existing project
    setVideoInfo(null);
    setAppMode('editor');
  }, [setVideoInfo]);

  const handleDeleteProject = useCallback((id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
      deleteProject(id);
    }
  }, [deleteProject]);

  const handleBackToHome = useCallback(() => {
    setAppMode('home');
    setCurrentProject(null);
    setVideoInfo(null);
  }, [setVideoInfo]);

  const handleTranslateText = useCallback(async (text: string) => {
    try {
      const translation = await translateText(text);
      const subtitle = subtitles.find(s => s.originalText === text);
      if (subtitle) {
        updateSubtitle(subtitle.id, { translatedText: translation.translated });
      }
    } catch (error) {
      console.error('Translation failed:', error);
    }
  }, [translateText, subtitles, updateSubtitle]);

  const handleSeekToSubtitle = useCallback((startTime: number, subtitleId: string) => {
    setCurrentTime(startTime);
    setActiveSubtitle(subtitleId);
  }, [setCurrentTime, setActiveSubtitle]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Languages className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Skip sign in page - go directly to home
  // if (!user) {
  //   return <SignInPage onSignIn={signInWithGoogle} isLoading={authLoading} />;
  // }

  // Home page
  if (appMode === 'home') {
    return (
      <>
        <HomePage
          user={user}
          projects={projects}
          onCreateProject={() => setShowCreateModal(true)}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteProject}
        />
        
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateProject={handleCreateProject}
          isProcessing={isProcessing}
          progress={progress}
          extractYouTubeTitle={extractYouTubeTitle}
        />
      </>
    );
  }

  // Editor mode - Show message if no video is loaded yet
  if (!videoInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center" dir="rtl">
        <div className="text-center max-w-md">
          <button
            onClick={handleBackToHome}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 transition-colors"
          >
            ← العودة إلى صحن
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative" dir="rtl">
      <div className="max-w-full mx-auto px-4 lg:px-6 py-6">
        {/* Main Interface - Video takes most space */}
        <div className="flex gap-4 h-[calc(100vh-6rem)]">
          {/* Video Player - Takes most of the screen */}
          <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-strong">
            <VideoPlayer
              videoFile={videoInfo.file}
              videoSrc={videoInfo.url}
              subtitles={subtitles}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              onDurationChange={(duration) => console.log('Duration:', duration)}
            />
          </div>

          {/* Subtitle Editor - Compact side panel */}
          <div className="w-96 bg-white rounded-2xl shadow-strong overflow-hidden">
            <IntegratedSubtitlePanel
              subtitles={subtitles}
              activeSubtitle={activeSubtitle}
              currentTime={currentTime}
              videoTitle={videoInfo.title}
              onAddSubtitle={addSubtitle}
              onUpdateSubtitle={updateSubtitle}
              onDeleteSubtitle={deleteSubtitle}
              onSelectSubtitle={setActiveSubtitle}
              onDuplicateSubtitle={duplicateSubtitle}
              onTranslateText={handleTranslateText}
              onSeekToSubtitle={handleSeekToSubtitle}
              isTranslating={isTranslating}
              isAutoSaving={isAutoSaving}
            />
          </div>
        </div>
      </div>

      {/* Back to Home Button */}
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={handleBackToHome}
          className="bg-white/90 backdrop-blur-md text-gray-700 px-4 py-2 rounded-full shadow-lg hover:bg-white hover:shadow-xl transition-all duration-200 border border-gray-200 flex items-center gap-2"
        >
          ← العودة إلى صحن
        </button>
      </div>

      {/* Keyboard Shortcuts - Bottom Left */}
      <div className="fixed bottom-6 left-6 z-50">
        <div className="relative">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="bg-white/90 backdrop-blur-md text-gray-700 p-3 rounded-full shadow-lg hover:bg-white hover:shadow-xl transition-all duration-200 border border-gray-200"
            title="اختصارات لوحة المفاتيح"
          >
            <Keyboard className="w-5 h-5" />
          </button>
          
          {showShortcuts && (
            <div className="absolute bottom-full left-0 mb-3 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-200 p-4 min-w-[280px] animate-fade-in">
              <h4 className="font-medium text-gray-900 mb-3 text-center">اختصارات لوحة المفاتيح</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">تشغيل/إيقاف</span>
                  <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">Space</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">إضافة ترجمة</span>
                  <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">Ctrl+N</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">حفظ</span>
                  <kbd className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">Ctrl+S</kbd>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;