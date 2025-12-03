import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Components
import HomePage from '../components/HomePage';
import CreateProjectModal from '../components/CreateProjectModal';

// Hooks
import { useProjects } from '../hooks/useProjects';
import { useProjectStatusUpdates, useProjectPollingFallback } from '../hooks/useProjectStatusUpdates';

// Types
import { Project } from '../types';

const HomePageContainer = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  
  // Projects management - using a default user ID for local usage
  const defaultUserId = 'local-user';
  const { 
    projects, 
    createProject, 
    deleteProject,
    updateProjectFromWebSocket
  } = useProjects(defaultUserId);

  // Wrapper to match the ProjectProcessingUpdateHandler signature
  const handleProjectUpdate = (projectId: string, updates: any) => {
    updateProjectFromWebSocket(projectId, updates);
  };

  // Enable real-time project status updates
  useProjectStatusUpdates(projects, handleProjectUpdate);
  
  // Enable polling fallback for stuck projects
  useProjectPollingFallback(projects, handleProjectUpdate);

  const handleCreateProject = async (
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, 
    videoFile?: File, 
    youtubeUrl?: string,
    resolution?: string,
    videoInfo?: any,
    language?: string,
    audioLanguage?: string
  ) => {
    setIsCreatingProject(true);
    
    const { progress, currentStage, stageMessage, ...cleanProjectData } = projectData;
    
    if (videoFile) {
      await createProject({
        ...cleanProjectData,
        duration: 0
      } as any, resolution || '720p', videoFile, undefined, language);
    } else if (youtubeUrl) {
      await createProject({
        ...cleanProjectData,
        duration: videoInfo?.duration || 0
      } as any, resolution || '720p', undefined, videoInfo, language, audioLanguage);
    } else {
      setIsCreatingProject(false);
      throw new Error('Either video file or YouTube URL must be provided');
    }
    
    // Close modal immediately - progress will show on project card
    setShowCreateModal(false);
    setIsCreatingProject(false);
  };

  const handleOpenProject = (project: Project) => {
    if (project.status === 'transcribed' || project.status === 'completed') {
      navigate(`/${project.id}`);
    } else {
      alert(`المشروع لا يزال قيد المعالجة. الحالة: ${project.status}`);
    }
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
      deleteProject(id);
    }
  };

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
      />
    </>
  );
};

export default HomePageContainer;
