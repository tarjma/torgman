import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, Youtube, FileVideo, Loader2, CheckCircle } from 'lucide-react';
import { Project } from '../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, videoFile?: File, youtubeUrl?: string, resolution?: string) => Promise<void>;
  isProcessing: boolean;
  progress: number;
  extractYouTubeTitle?: (url: string) => Promise<string>;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  isProcessing,
  progress,
  extractYouTubeTitle
}) => {
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'youtube'>('file');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isExtractingTitle, setIsExtractingTitle] = useState(false);
  const [resolution, setResolution] = useState('720p');

  // Auto-extract title from YouTube URL
  useEffect(() => {
    const extractTitle = async () => {
      if (youtubeUrl && extractYouTubeTitle && uploadMode === 'youtube') {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
        if (youtubeRegex.test(youtubeUrl)) {
          setIsExtractingTitle(true);
          try {
            const title = await extractYouTubeTitle(youtubeUrl);
            if (!projectTitle) { // Only set if user hasn't manually entered a title
              setProjectTitle(title);
            }
          } catch (error) {
            console.error('Failed to extract YouTube title:', error);
          } finally {
            setIsExtractingTitle(false);
          }
        }
      }
    };

    // Debounce the extraction to avoid too many API calls
    const timeoutId = setTimeout(extractTitle, 1000);
    return () => clearTimeout(timeoutId);
  }, [youtubeUrl, extractYouTubeTitle, uploadMode, projectTitle]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0] && files[0].type.startsWith('video/')) {
      const file = files[0];
      setSelectedFile(file);
      // Auto-set project title if empty
      if (!projectTitle) {
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        setProjectTitle(fileName);
      }
    }
  }, [projectTitle]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      setSelectedFile(file);
      // Auto-set project title if empty
      if (!projectTitle) {
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        setProjectTitle(fileName);
      }
    }
  }, [projectTitle]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectTitle.trim()) {
      alert('يرجى إدخال اسم المشروع');
      return;
    }

    if (uploadMode === 'file' && !selectedFile) {
      alert('يرجى اختيار ملف فيديو');
      return;
    }

    if (uploadMode === 'youtube' && !youtubeUrl.trim()) {
      alert('يرجى إدخال رابط يوتيوب');
      return;
    }

    const projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
      title: projectTitle.trim(),
      description: projectDescription.trim() || undefined,
      videoTitle: uploadMode === 'file' 
        ? selectedFile?.name.replace(/\.[^/.]+$/, '') || 'فيديو محلي'
        : 'فيديو يوتيوب',
      videoUrl: uploadMode === 'youtube' ? youtubeUrl.trim() : undefined,
      videoFile: uploadMode === 'file' ? selectedFile?.name : undefined,
      subtitlesCount: 0,
      duration: 0,
      language: 'auto-detect',
      status: 'draft'
    };

    try {
      await onCreateProject(
        projectData, 
        uploadMode === 'file' ? selectedFile || undefined : undefined,
        uploadMode === 'youtube' ? youtubeUrl.trim() : undefined,
        uploadMode === 'youtube' ? resolution : undefined
      );
    } catch (error) {
      console.error('Project creation failed:', error);
    }
  }, [projectTitle, projectDescription, uploadMode, selectedFile, youtubeUrl, resolution, onCreateProject]);

  const resetForm = useCallback(() => {
    setProjectTitle('');
    setProjectDescription('');
    setYoutubeUrl('');
    setSelectedFile(null);
    setUploadMode('file');
    setResolution('720p');
  }, []);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      resetForm();
      onClose();
    }
  }, [isProcessing, resetForm, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">إنشاء مشروع جديد</h2>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="p-6 text-center border-b bg-blue-50">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">جاري معالجة الفيديو...</h3>
            <p className="text-gray-600 mb-4">يتم استخراج الصوت وتحليل المحتوى</p>
            
            <div className="max-w-xs mx-auto">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-medium text-blue-600">{progress}% مكتمل</span>
                {progress === 100 && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">تم بنجاح!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Details */}
          <div className="space-y-4">
            <div>
              <label htmlFor="project-title" className="block text-sm font-medium text-gray-700 mb-2">
                اسم المقطع المرئى *
              </label>
              <input
                id="project-title"
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="مثال: ترجمة محاضرة التسويق الرقمي"
                required
                disabled={isProcessing}
              />
            </div>
            
            <div>
              <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 mb-2">
                ملخص المحتوى (اختياري)
              </label>
              <textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="وصف مختصر عن المشروع..."
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Upload Mode Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              مصدر الفيديو *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                disabled={isProcessing}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  uploadMode === 'file'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FileVideo className="w-4 h-4" />
                رفع ملف
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('youtube')}
                disabled={isProcessing}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                  uploadMode === 'youtube'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Youtube className="w-4 h-4" />
                يوتيوب
              </button>
            </div>
          </div>

          {/* File Upload */}
          {uploadMode === 'file' && (
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                
                {selectedFile ? (
                  <div className="space-y-2">
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-600">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} ميجابايت
                    </p>
                    {!isProcessing && (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        إزالة الملف
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-gray-900 font-medium">اسحب وأفلت ملف الفيديو هنا</p>
                    <p className="text-gray-600">أو انقر للاختيار من جهازك</p>
                    <p className="text-xs text-gray-500">
                      الصيغ المدعومة: MP4, AVI, MOV, MKV (حد أقصى 500 ميجابايت)
                    </p>
                  </div>
                )}
              </div>
              
              <input
                type="file"
                accept="video/*"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isProcessing}
              />
            </div>
          )}

          {/* YouTube URL */}
          {uploadMode === 'youtube' && (
            <>
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700">
                  رابط فيديو يوتيوب *
                </label>
                <div className="relative">
                  <Youtube className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500 w-5 h-5" />
                  <input
                    id="youtube-url"
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="https://youtube.com/watch?v=..."
                    dir="ltr"
                    required
                    disabled={isProcessing}
                  />
                  {isExtractingTitle && (
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Video Resolution Selection */}
              <div className="space-y-2">
                <label htmlFor="resolution" className="block text-sm font-medium text-gray-700">
                  جودة الفيديو
                </label>
                <select
                  id="resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={isProcessing}
                >
                  <option value="144p">144p - جودة منخفضة</option>
                  <option value="240p">240p - جودة منخفضة</option>
                  <option value="360p">360p - جودة متوسطة</option>
                  <option value="480p">480p - جودة متوسطة</option>
                  <option value="720p">720p - جودة عالية (موصى بها)</option>
                  <option value="1080p">1080p - جودة عالية جداً</option>
                  <option value="best">أفضل جودة متاحة</option>
                </select>
                <p className="text-xs text-gray-500">
                  جودة أعلى = ملف أكبر وتحميل أطول، لكن صوت أوضح
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isProcessing || !projectTitle.trim() || (uploadMode === 'file' && !selectedFile) || (uploadMode === 'youtube' && !youtubeUrl.trim())}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                'إنشاء المشروع'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;