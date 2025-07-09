import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { projectService } from '../services/projectService';

interface ProjectThumbnailProps {
  projectId: string;
  projectTitle: string;
  className?: string;
}

const ProjectThumbnail: React.FC<ProjectThumbnailProps> = ({ 
  projectId, 
  projectTitle, 
  className = "w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center" 
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadThumbnail = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        const url = await projectService.getProjectThumbnail(projectId);
        if (url) {
          setThumbnailUrl(url);
        } else {
          setHasError(true);
        }
      } catch (error) {
        console.error('Error loading thumbnail:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadThumbnail();

    // Cleanup function to revoke blob URL
    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [projectId]);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="animate-pulse bg-gray-200 w-full h-full rounded-lg flex items-center justify-center">
          <Play className="w-8 h-8 text-gray-400" />
        </div>
      </div>
    );
  }

  if (hasError || !thumbnailUrl) {
    return (
      <div className={className}>
        <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Play className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-xs text-gray-600 font-medium px-2 truncate">
              {projectTitle}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative w-full h-full rounded-lg overflow-hidden">
        <img 
          src={thumbnailUrl} 
          alt={`${projectTitle} thumbnail`}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
          <Play className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity duration-200" />
        </div>
      </div>
    </div>
  );
};

export default ProjectThumbnail;
