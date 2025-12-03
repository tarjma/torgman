import React, { useState, useEffect } from 'react';
import { Clock, FileText, Trash2, Loader2 } from 'lucide-react';
import { Project } from '../types';
import ProjectThumbnail from './ProjectThumbnail';
import ProcessingStages from './ProcessingStages';

interface ProjectCardProps {
  project: Project;
  viewMode: 'grid' | 'list';
  onOpenProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  viewMode,
  onOpenProject,
  onDeleteProject
}) => {
  // Track recent completion for success animation
  const [justCompleted, setJustCompleted] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(project.status);
  
  // Watch for completion - show animation when transitioning from 'processing' to 'transcribed' or 'completed'
  useEffect(() => {
    if (previousStatus === 'processing' && (project.status === 'transcribed' || project.status === 'completed')) {
      setJustCompleted(true);
      // Show success animation for 2 seconds
      const timer = setTimeout(() => setJustCompleted(false), 2000);
      return () => clearTimeout(timer);
    }
    setPreviousStatus(project.status);
  }, [project.status, previousStatus]);
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return 'الآن';
    } else if (diffMinutes < 60) {
      return `منذ ${diffMinutes} ${diffMinutes === 1 ? 'دقيقة' : diffMinutes === 2 ? 'دقيقتين' : 'دقائق'}`;
    } else if (diffHours < 24) {
      return `منذ ${diffHours} ${diffHours === 1 ? 'ساعة' : diffHours === 2 ? 'ساعتين' : 'ساعات'}`;
    } else if (diffDays < 7) {
      return `منذ ${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومين' : 'أيام'}`;
    } else if (diffWeeks < 4) {
      return `منذ ${diffWeeks} ${diffWeeks === 1 ? 'أسبوع' : diffWeeks === 2 ? 'أسبوعين' : 'أسابيع'}`;
    } else if (diffMonths < 12) {
      return `منذ ${diffMonths} ${diffMonths === 1 ? 'شهر' : diffMonths === 2 ? 'شهرين' : 'أشهر'}`;
    } else {
      return `منذ ${diffYears} ${diffYears === 1 ? 'سنة' : diffYears === 2 ? 'سنتين' : 'سنوات'}`;
    }
  };

  const estimateRemainingTime = (project: Project): string | null => {
    if (!project.progress || project.progress === 0 || project.progress >= 95) {
      return null;
    }
    
    // Rough estimation: 1 minute of video = 30-60 seconds of processing
    // Transcription is ~75% of the work
    const videoDuration = project.duration || 0;
    const totalEstimatedSeconds = videoDuration * 0.5; // 0.5x video length
    
    const progressPercent = project.progress / 100;
    const elapsedEstimate = totalEstimatedSeconds * progressPercent;
    const remainingEstimate = totalEstimatedSeconds - elapsedEstimate;
    
    if (remainingEstimate < 60) {
      return `~${Math.ceil(remainingEstimate)} ثانية متبقية`;
    } else {
      const minutes = Math.ceil(remainingEstimate / 60);
      return `~${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'} متبقية`;
    }
  };

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'transcribed':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: Project['status']) => {
    switch (status) {
      case 'transcribed':
        return 'تفريغ مكتمل';
      case 'completed':
        return 'ترجمة مكتملة';
      case 'processing':
        return 'جاري المعالجة';
      case 'error':
        return 'خطأ';
      case 'draft':
        return 'مسودة';
      default:
        return 'غير معروف';
    }
  };

  const isProcessing = project.status === 'processing';
  const isError = project.status === 'error' || project.status === 'failed';

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border transition-all duration-200 relative ${
        viewMode === 'list' ? 'flex items-center p-4' : 'p-6'
      } ${
        isProcessing 
          ? 'cursor-default opacity-90' 
          : isError
            ? 'cursor-default opacity-90'
            : 'hover:shadow-md cursor-pointer'
      }`}
      onClick={() => !isProcessing && !isError && onOpenProject(project)}
    >
      {/* Processing Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-white bg-opacity-95 rounded-lg flex items-center justify-center z-10 p-6">
          <div className="text-center w-full max-w-xs">
            {/* Animated Icon */}
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            
            {/* Processing Stages Visual */}
            {project.currentStage && project.progress !== undefined && project.progress > 0 && (
              <div className="mb-4">
                <ProcessingStages 
                  currentStage={project.currentStage} 
                  progress={project.progress} 
                />
              </div>
            )}
            
            {/* Progress Bar */}
            <div className="mb-3">
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${project.progress || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{project.progress || 0}%</span>
                <span className="font-medium">جاري المعالجة</span>
              </div>
            </div>
            
            {/* Stage Message */}
            <p className="text-sm font-medium text-gray-900 mb-1">
              {project.stageMessage || 'جاري التحضير...'}
            </p>
            
            {/* Additional Info */}
            <p className="text-xs text-gray-500">
              {project.currentStage === 'generating_subtitles' 
                ? '⏰ هذه الخطوة قد تستغرق عدة دقائق'
                : project.videoUrl ? 'مصدر: يوتيوب' : 'مصدر: ملف محلي'
              }
            </p>
            
            {/* Time Estimate */}
            {estimateRemainingTime(project) && (
              <p className="text-xs text-blue-600 font-medium mt-2">
                {estimateRemainingTime(project)}
              </p>
            )}
            
            {/* Helpful tip for slow stage */}
            {project.currentStage === 'generating_subtitles' && (
              <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                💡 يمكنك إغلاق هذه الصفحة والعودة لاحقاً
              </div>
            )}
            
            {/* Manual refresh button */}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const response = await fetch(`/api/projects/${project.id}`);
                  if (response.ok) {
                    // Force a re-render by reloading the page
                    window.location.reload();
                  }
                } catch (error) {
                  console.error('Failed to check status:', error);
                }
              }}
              className="mt-3 px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors text-gray-700"
            >
              🔄 تحديث الحالة
            </button>
          </div>
        </div>
      )}
      
      {/* Error Overlay */}
      {isError && (
        <div className="absolute inset-0 bg-white bg-opacity-95 rounded-lg flex items-center justify-center z-10 p-6">
          <div className="text-center w-full max-w-xs">
            {/* Error Icon */}
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            
            {/* Error Message */}
            <p className="text-sm font-medium text-gray-900 mb-2">
              فشلت معالجة المشروع
            </p>
            <p className="text-xs text-gray-600 mb-4 line-clamp-3">
              {project.errorMessage || project.stageMessage || 'حدث خطأ أثناء المعالجة'}
            </p>
            
            {/* Action Buttons */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement retry logic
                  alert('سيتم إضافة خاصية إعادة المحاولة قريباً');
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                🔄 إعادة المحاولة
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
                    onDeleteProject(project.id);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                🗑️ حذف
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Animation Overlay */}
      {justCompleted && (
        <div className="absolute inset-0 bg-white bg-opacity-95 rounded-lg flex items-center justify-center z-20 animate-fadeIn">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-gray-900">اكتمل بنجاح!</p>
            <p className="text-sm text-gray-600 mt-1">جاهز للتحرير</p>
          </div>
        </div>
      )}

      {viewMode === 'grid' ? (
        <>
          <div className="relative">
            <ProjectThumbnail 
              projectId={project.id}
              projectTitle={project.title}
              className="w-full h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black bg-opacity-20 rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <div>
              <h3 className="font-medium text-gray-900 line-clamp-2">
                {project.title}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-1">
                {project.videoTitle}
              </p>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                <span>{project.subtitlesCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formatTime(project.duration)}</span>
              </div>
            </div>
            
            <div className="text-xs text-gray-400">
              {formatRelativeTime(project.updatedAt)}
            </div>
            
            <div className="flex items-center justify-between">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                {getStatusText(project.status)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isProcessing) {
                    if (window.confirm('هذا المشروع قيد المعالجة. هل تريد حذفه؟')) {
                      onDeleteProject(project.id);
                    }
                  } else {
                    onDeleteProject(project.id);
                  }
                }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="relative">
            <ProjectThumbnail 
              projectId={project.id}
              projectTitle={project.title}
              className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 ml-4"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black bg-opacity-20 rounded-lg flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">
                  {project.title}
                </h3>
                <p className="text-sm text-gray-600 truncate">
                  {project.videoTitle}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 mr-2 ${getStatusColor(project.status)}`}>
                {getStatusText(project.status)}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span>{project.subtitlesCount} ترجمة</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(project.duration)}</span>
                </div>
                <span className="text-xs text-gray-400">{formatRelativeTime(project.updatedAt)}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isProcessing) {
                    if (window.confirm('هذا المشروع قيد المعالجة. هل تريد حذفه؟')) {
                      onDeleteProject(project.id);
                    }
                  } else {
                    onDeleteProject(project.id);
                  }
                }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectCard;
