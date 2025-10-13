import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Components
import HomePage from '../components/HomePage';
import CreateProjectModal from '../components/CreateProjectModal';

// Hooks
import { useProjects } from '../hooks/useProjects';
import { useVideoProcessor } from '../hooks/useVideoProcessor';
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

  const {
    progress
  } = useVideoProcessor();

  const handleCreateProject = async (
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, 
    videoFile?: File, 
    youtubeUrl?: string,
    resolution?: string,
    videoInfo?: any,
    language?: string,
    audioLanguage?: string
  ) => {
    console.log('handleCreateProject called', { projectData, videoFile, youtubeUrl, resolution, language, audioLanguage });
    
    setIsCreatingProject(true);
    
    try {
      let newProject = null;
      
      if (videoFile) {
        console.log('Processing file upload...');
        const { progress, currentStage, stageMessage, ...cleanProjectData } = projectData;
        newProject = await createProject({
          ...cleanProjectData,
          duration: 0
        } as any, resolution || '720p', videoFile, undefined, language);
        
        console.log('Project created:', newProject);
        
        if (newProject) {
          // Wait 2 seconds to show initial progress, then close
          await new Promise(resolve => setTimeout(resolve, 2000));
          setShowCreateModal(false);
          console.log('File upload started, modal closing, tracking via card');
        }
      } else if (youtubeUrl) {
        console.log('Processing YouTube URL...');
        const { progress, currentStage, stageMessage, ...cleanProjectData } = projectData;
        newProject = await createProject({
          ...cleanProjectData,
          duration: videoInfo?.duration || 0
        } as any, resolution || '720p', undefined, videoInfo, language, audioLanguage);

        if (newProject) {
          // Wait 2 seconds to show initial progress, then close
          await new Promise(resolve => setTimeout(resolve, 2000));
          setShowCreateModal(false);
          console.log('YouTube project created, modal closing, tracking via card');
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
  };

  const handleOpenProject = (project: Project) => {
    console.log('Opening project:', project);
    if (project.status === 'transcribed' || project.status === 'completed') {
      // Navigate to project editor page
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
        progress={progress}
      />
    </>
  );
};

export default HomePageContainer;
