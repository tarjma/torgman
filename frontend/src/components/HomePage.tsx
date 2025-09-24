import React, { useState } from 'react';
import { Plus, Search, Grid, List, Languages, FileText, Settings } from 'lucide-react';
import { Project } from '../types';
import ProjectCard from './ProjectCard';
import ApiKeyModal from './ApiKeyModal';
import { useApiKey } from '../hooks/useApiKey';

interface HomePageProps {
  projects: Project[];
  onCreateProject: () => void;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({
  projects,
  onCreateProject,
  onOpenProject,
  onDeleteProject
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const { status: apiKeyStatus, reloadStatus } = useApiKey();

  // Handle modal close
  const handleCloseApiKeyModal = () => {
    setShowApiKeyModal(false);
  };

  // Filter projects based on search query
  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.videoTitle && project.videoTitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Languages className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">ترجمان</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* API Key Status Indicator */}
              {apiKeyStatus && (
                <button
                  onClick={() => setShowApiKeyModal(true)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    apiKeyStatus.has_api_key
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                  title={apiKeyStatus.has_api_key ? 'مفتاح API متكون' : 'لم يتم تكوين مفتاح API'}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {apiKeyStatus.has_api_key ? 'API مُكون' : 'تكوين API'}
                  </span>
                </button>
              )}
              
              <button
                onClick={onCreateProject}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                مشروع جديد
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="البحث في المشاريع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Projects */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'لا توجد مشاريع مطابقة' : 'لا توجد مشاريع بعد'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery 
                ? 'جرب تغيير كلمات البحث'
                : 'ابدأ بإنشاء مشروع ترجمة جديد'
              }
            </p>
            {!searchQuery && (
              <button
                onClick={onCreateProject}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                إنشاء مشروع جديد
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
          }>
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                viewMode={viewMode}
                onOpenProject={onOpenProject}
                onDeleteProject={onDeleteProject}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* API Key Configuration Modal */}
      <ApiKeyModal 
        isOpen={showApiKeyModal} 
        onClose={handleCloseApiKeyModal}
        onApiKeyChanged={reloadStatus}
      />
    </div>
  );
};

export default HomePage;