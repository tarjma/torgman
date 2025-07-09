import React from 'react';
import { Clock, FileText, Trash2, Loader2 } from 'lucide-react';
import { Project } from '../types';
import ProjectThumbnail from './ProjectThumbnail';

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
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  };

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
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
      case 'completed':
        return 'مكتمل';
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

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border transition-all duration-200 relative ${
        viewMode === 'list' ? 'flex items-center p-4' : 'p-6'
      } ${
        isProcessing 
          ? 'cursor-default opacity-90' 
          : 'hover:shadow-md cursor-pointer'
      }`}
      onClick={() => !isProcessing && onOpenProject(project)}
    >
      {/* Processing Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-white bg-opacity-90 rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">جاري التحضير...</p>
            <p className="text-xs text-gray-600">
              {project.videoUrl ? 'تحميل فيديو يوتيوب' : 'معالجة الملف المرفوع'}
            </p>
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
            
            <div className="flex items-center justify-between">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                {getStatusText(project.status)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject(project.id);
                }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                disabled={isProcessing}
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
                <span>{formatDate(project.updatedAt)}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject(project.id);
                }}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                disabled={isProcessing}
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
