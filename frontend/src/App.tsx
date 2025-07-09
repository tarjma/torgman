import { useState, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Languages, Keyboard } from 'lucide-react';

// Components
import HomePage from './components/HomePage';
import CreateProjectModal from './components/CreateProjectModal';
import VideoPlayer from './components/VideoPlayer';
import IntegratedSubtitlePanel from './components/IntegratedSubtitlePanel';

// Hooks
import { useProjects } from './hooks/useProjects';
import { useSubtitles } from './hooks/useSubtitles';
import { useVideoProcessor } from './hooks/useVideoProcessor';
import { useAITranslation } from './hooks/useAITranslation';
import { useProjectStatusUpdates } from './hooks/useProjectStatusUpdates';
import { useProjectSubtitleUpdates } from './hooks/useProjectSubtitleUpdates';

// Services
import { projectService } from './services/projectService';

// Types
import { Project } from './types';

type AppMode = 'home' | 'editor';

function App() {
  const [appMode, setAppMode] = useState<AppMode>('home');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Projects management - using a default user ID for local usage
  const defaultUserId = 'local-user';
  const { 
    projects, 
    createProject, 
    updateProjectFromWebSocket,
    deleteProject 
  } = useProjects(defaultUserId);

  // Set up real-time project status updates
  useProjectStatusUpdates(projects, updateProjectFromWebSocket);

  // Set up real-time subtitle updates for the current project
  useProjectSubtitleUpdates(currentProjectId, (subtitles) => {
    console.log('Received subtitle update:', subtitles);
    loadSubtitles(subtitles);
  });

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
    duplicateSubtitle,
    loadSubtitles,
    clearSubtitles,
    // Navigation functions
    findNextSubtitle,
    findPreviousSubtitle,
    seekToSubtitle,
    getSubtitleByTime,
    updateActiveSubtitleByTime
  } = useSubtitles();

  const {
    videoInfo,
    progress,
    setVideoInfo
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
    resolution?: string,
    videoInfo?: any // Add videoInfo parameter
  ) => {
    console.log('handleCreateProject called', { projectData, videoFile, youtubeUrl, resolution });
    
    setIsCreatingProject(true);
    
    try {
      let newProject = null;
      
      if (videoFile) {
        console.log('Processing file upload...');
        // For file uploads, create project but don't navigate immediately
        newProject = await createProject({
          ...projectData,
          duration: 0 // Will be updated when backend processing completes
        }, resolution || '720p', videoFile);
        
        console.log('Project created:', newProject);
        
        if (newProject) {
          // Close modal after successful creation
          setShowCreateModal(false);
          console.log('File upload started, staying on home page until completion');
        }
      } else if (youtubeUrl) {
        console.log('Processing YouTube URL...');
        // For YouTube URLs, create project but don't navigate immediately
        // Use video info from modal instead of calling processYouTubeUrl
        newProject = await createProject({
          ...projectData,
          duration: videoInfo?.duration || 0 // Use duration from pre-fetched info
        }, resolution || '720p', undefined, videoInfo); // Pass videoInfo as 4th parameter

        if (newProject) {
          // Close modal after successful creation
          setShowCreateModal(false);
          console.log('YouTube project created, staying on home page until completion');
        }
      } else {
        throw new Error('Either video file or YouTube URL must be provided');
      }
    } catch (error) {
      console.error('Project creation failed:', error);
      alert(`فشل في إنشاء المشروع: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setIsCreatingProject(false);
    }
  }, [createProject]);

  const handleOpenProject = useCallback(async (project: Project) => {
    console.log('Opening project:', project);
    // Only navigate to editor if project is completed
    if (project.status === 'completed') {
      try {
        // Load subtitles from backend
        console.log('Loading subtitles for project:', project.id);
        const backendSubtitles = await projectService.getProjectSubtitles(project.id);
        console.log('Backend subtitles received:', backendSubtitles);
        
        // Convert backend subtitles to frontend format
        const frontendSubtitles = backendSubtitles.map((sub, index) => ({
          id: `${project.id}-${index}`, // Generate unique ID
          start_time: sub.start,
          end_time: sub.end,
          text: sub.text,
          originalText: sub.text,
          translatedText: '',
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
        
        // Load subtitles using the bulk load method
        loadSubtitles(frontendSubtitles);
        
        // Set the current project ID for real-time updates
        setCurrentProjectId(project.id);
        
        // For completed projects, load the appropriate video source
        if (project.videoUrl) {
          // YouTube video - load the downloaded video file from server
          const videoUrl = await projectService.getProjectVideo(project.id);
          setVideoInfo({
            url: videoUrl,
            duration: project.duration,
            title: project.videoTitle,
            language: project.language || 'ar'
          });
        } else if (project.videoFile) {
          // File upload - this would need to be handled differently
          // For now, we'll just set the basic info
          setVideoInfo({
            title: project.videoTitle,
            duration: project.duration,
            language: project.language || 'ar'
          });
        }
        setAppMode('editor');
      } catch (error) {
        console.error('Error loading project video:', error);
        alert('فشل في تحميل الفيديو. يرجى المحاولة مرة أخرى.');
      }
    } else {
      // For processing projects, show processing status
      alert(`المشروع لا يزال قيد المعالجة. الحالة: ${project.status}`);
    }
  }, [setVideoInfo, loadSubtitles, projectService]);

  const handleDeleteProject = useCallback((id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
      deleteProject(id);
    }
  }, [deleteProject]);

  const handleBackToHome = useCallback(() => {
    setAppMode('home');
    setVideoInfo(null);
    clearSubtitles();
    setCurrentProjectId(null);
  }, [setVideoInfo, clearSubtitles]);

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

  // Auto-update active subtitle based on current time
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
    // Update active subtitle automatically
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

  // Home page
  if (appMode === 'home') {
    return (
      <>
        <HomePage
          projects={projects}
          onCreateProject={() => setShowCreateModal(true)}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteProject}
        />
        
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateProject={handleCreateProject}
          isProcessing={isCreatingProject}
          progress={progress}
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
          {/* Subtitle Editor - Compact side panel */}
          <div className="w-96 bg-white rounded-2xl shadow-strong overflow-hidden">
            <IntegratedSubtitlePanel
              subtitles={subtitles}
              activeSubtitle={activeSubtitle}
              currentTime={currentTime}
              videoTitle={videoInfo.title}
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
            />
          </div>

          {/* Video Player - Takes most of the screen */}
          <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-strong">
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