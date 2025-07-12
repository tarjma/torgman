import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Components
import HomePage from '../components/HomePage';
import CreateProjectModal from '../components/CreateProjectModal';

// Hooks
import { useProjects } from '../hooks/useProjects';
import { useVideoProcessor } from '../hooks/useVideoProcessor';

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
    deleteProject 
  } = useProjects(defaultUserId);

  const {
    progress
  } = useVideoProcessor();

  const handleCreateProject = async (
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, 
    videoFile?: File, 
    youtubeUrl?: string,
    resolution?: string,
    videoInfo?: any
  ) => {
    console.log('handleCreateProject called', { projectData, videoFile, youtubeUrl, resolution });
    
    setIsCreatingProject(true);
    
    try {
      let newProject = null;
      
      if (videoFile) {
        console.log('Processing file upload...');
        newProject = await createProject({
          ...projectData,
          duration: 0
        }, resolution || '720p', videoFile);
        
        console.log('Project created:', newProject);
        
        if (newProject) {
          setShowCreateModal(false);
          console.log('File upload started, staying on home page until completion');
        }
      } else if (youtubeUrl) {
        console.log('Processing YouTube URL...');
        newProject = await createProject({
          ...projectData,
          duration: videoInfo?.duration || 0
        }, resolution || '720p', undefined, videoInfo);

        if (newProject) {
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
  };

  const handleOpenProject = (project: Project) => {
    console.log('Opening project:', project);
    if (project.status === 'completed') {
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
