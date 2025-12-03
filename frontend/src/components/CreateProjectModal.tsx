import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, Youtube, FileVideo, Loader2, CheckCircle, RefreshCw, Info } from 'lucide-react';
import { Project } from '../types';
import { youtubeService, YouTubeVideoInfo } from '../services/youtubeService';
import { wsManager } from '../services/websocket';
import SearchableLanguageSelect, { LANGUAGE_MAP } from './SearchableLanguageSelect';

// Move constants outside component for better performance
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;

const RESOLUTION_LABELS: { [key: string]: string } = {
  '144p': 'جودة منخفضة',
  '240p': 'جودة منخفضة',
  '360p': 'جودة متوسطة',
  '480p': 'جودة متوسطة',
  '720p': 'جودة عالية',
  '1080p': 'جودة عالية جداً',
  '1440p': 'جودة فائقة',
  '2160p': 'جودة 4K',
  'best': 'أفضل جودة متاحة',
  'worst': 'أقل جودة متاحة'
};

type ProjectType = 'youtube' | 'file';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, videoFile?: File, youtubeUrl?: string, resolution?: string, videoInfo?: YouTubeVideoInfo, language?: string, audioLanguage?: string) => Promise<void>;
  isProcessing: boolean;
  progress: number;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  isProcessing,
  progress
}) => {
  const [projectType, setProjectType] = useState<ProjectType>('youtube');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [resolution, setResolution] = useState('720p');
  const [projectLanguage, setProjectLanguage] = useState('auto');
  const [audioLanguage, setAudioLanguage] = useState<string>('auto');
  
  // YouTube video info states
  const [videoInfo, setVideoInfo] = useState<YouTubeVideoInfo | null>(null);
  const [isLoadingVideoInfo, setIsLoadingVideoInfo] = useState(false);
  const [videoInfoError, setVideoInfoError] = useState<string | null>(null);

  // Add state for tracking manual title input and validation errors
  const [isTitleManuallySet, setIsTitleManuallySet] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  
  // Track real backend progress
  const [backendProgress, setBackendProgress] = useState(0);
  const [backendStage, setBackendStage] = useState('');

  const resetForm = useCallback(() => {
    setProjectType('youtube');
    setProjectTitle('');
    setProjectDescription('');
    setYoutubeUrl('');
    setSelectedFile(null);
    setResolution('720p');
    setProjectLanguage('auto');
    setAudioLanguage('auto');
    setVideoInfo(null);
    setVideoInfoError(null);
    setIsLoadingVideoInfo(false);
    setIsTitleManuallySet(false);
    setValidationErrors({});
  }, []);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      resetForm();
      onClose();
    }
  }, [isProcessing, resetForm, onClose]);

  // Auto-fetch YouTube info when URL changes (debounced)
  useEffect(() => {
    if (projectType !== 'youtube' || !youtubeUrl.trim()) {
      return;
    }

    if (YOUTUBE_REGEX.test(youtubeUrl)) {
      const handler = setTimeout(() => {
        handleFetchYouTubeInfo();
      }, 500); // 500ms debounce

      return () => {
        clearTimeout(handler);
      };
    } else if (youtubeUrl.trim()) {
      // Show validation error for invalid URL
      setVideoInfoError('رابط يوتيوب غير صحيح');
      setVideoInfo(null);
    }
  }, [youtubeUrl, projectType]);
  
  // Set default audio language to original when video info loads
  useEffect(() => {
    if (videoInfo?.original_audio_language && videoInfo.available_audio_languages?.length) {
      setAudioLanguage(videoInfo.original_audio_language);
    }
  }, [videoInfo]);
  
  // Listen to WebSocket updates during modal processing
  useEffect(() => {
    if (!isProcessing) {
      setBackendProgress(0);
      setBackendStage('');
      return;
    }
    
    const handleProgress = (message: any) => {
      if (message.type === 'status' && message.progress !== undefined) {
        setBackendProgress(message.progress);
        setBackendStage(message.status || '');
      }
    };
    
    wsManager.addEventListener('*', handleProgress);
    
    return () => {
      wsManager.removeEventListener('*', handleProgress);
    };
  }, [isProcessing]);

  // Manual YouTube info fetching
  const handleFetchYouTubeInfo = useCallback(async () => {
    if (!youtubeUrl.trim()) {
      setVideoInfoError('يرجى إدخال رابط يوتيوب صحيح');
      return;
    }

    if (!YOUTUBE_REGEX.test(youtubeUrl)) {
      setVideoInfoError('رابط يوتيوب غير صحيح');
      return;
    }

    setIsLoadingVideoInfo(true);
    setVideoInfoError(null);

    try {
  const info = await youtubeService.getVideoInfo(youtubeUrl);
  setVideoInfo(info);
      
      // Auto-set title only if not manually set
      if (!isTitleManuallySet && info.title) {
        setProjectTitle(info.title);
      }
      
      // Set recommended resolution if available
      const avail = (info.available_resolutions && info.available_resolutions.length > 0)
        ? info.available_resolutions
        : (info.resolution_sizes ? info.resolution_sizes.map(r => r.resolution) : []);
      if (info.recommended_resolution && avail.includes(info.recommended_resolution)) {
        setResolution(info.recommended_resolution);
      } else if (avail.length > 0) {
        setResolution('best');
      } else {
        // Default to best when none listed yet
        setResolution('best');
      }
    } catch (error) {
      console.error('Failed to fetch YouTube video info:', error);
      setVideoInfoError('فشل في جلب معلومات الفيديو. تحقق من الرابط وحاول مرة أخرى.');
    } finally {
      setIsLoadingVideoInfo(false);
    }
  }, [youtubeUrl, isTitleManuallySet]);

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
      // Auto-set project title only if not manually set
      if (!isTitleManuallySet) {
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        setProjectTitle(fileName);
      }
    }
  }, [isTitleManuallySet]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      setSelectedFile(file);
      // Auto-set project title only if not manually set
      if (!isTitleManuallySet) {
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        setProjectTitle(fileName);
      }
    }
  }, [isTitleManuallySet]);

  // Fixed resolution logic - only show actual available resolutions
  const getAvailableResolutions = () => {
    if (videoInfo?.available_resolutions && videoInfo.available_resolutions.length > 0) {
      return ['best', ...videoInfo.available_resolutions];
    }
    // If resolutions are not explicitly listed, infer from sizes if available
    if (videoInfo?.resolution_sizes && videoInfo.resolution_sizes.length > 0) {
      const inferred = videoInfo.resolution_sizes.map(r => r.resolution);
      return ['best', ...inferred];
    }
    return [];
  };

  const getResolutionLabel = (res: string): string => {
    return RESOLUTION_LABELS[res] || 'جودة غير محددة';
  };

  // Validation function
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!projectTitle.trim()) {
      errors.title = 'اسم المشروع مطلوب';
    }
    
    if (projectType === 'file' && !selectedFile) {
      errors.file = 'يرجى اختيار ملف فيديو';
    }
    
    if (projectType === 'youtube' && !youtubeUrl.trim()) {
      errors.youtube = 'يرجى إدخال رابط يوتيوب';
    }
    
    if (projectType === 'youtube' && youtubeUrl.trim() && !YOUTUBE_REGEX.test(youtubeUrl)) {
      errors.youtube = 'رابط يوتيوب غير صحيح';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const isYoutube = projectType === 'youtube';
    const projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
      title: projectTitle.trim(),
      description: projectDescription.trim() || undefined,
      videoTitle: isYoutube 
        ? videoInfo?.title || 'فيديو يوتيوب'
        : selectedFile?.name.replace(/\.[^/.]+$/, '') || 'فيديو محلي',
      videoUrl: isYoutube ? youtubeUrl.trim() : undefined,
      videoFile: !isYoutube ? selectedFile?.name : undefined,
      subtitlesCount: 0,
      duration: 0,
      language: 'auto-detect',
      status: 'draft'
    };

    try {
      await onCreateProject(
        projectData, 
        !isYoutube ? selectedFile || undefined : undefined,
        isYoutube ? youtubeUrl.trim() : undefined,
        isYoutube ? resolution : undefined,
        isYoutube ? videoInfo || undefined : undefined,
        projectLanguage !== 'auto' ? projectLanguage : undefined,
        isYoutube && audioLanguage !== 'auto' ? audioLanguage : undefined
      );
    } catch (error) {
      console.error('Project creation failed:', error);
    }
  }, [projectTitle, projectDescription, projectType, selectedFile, youtubeUrl, videoInfo, resolution, projectLanguage, audioLanguage, onCreateProject]);

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
            <h3 className="text-lg font-medium text-gray-900 mb-2">جاري معالجة المشروع...</h3>
            
            {/* Show stage-specific message */}
            <p className="text-gray-600 mb-4">
              {backendStage === 'downloading_video' && 'جاري تحميل الفيديو من يوتيوب...'}
              {backendStage === 'extracting_audio' && 'جاري استخراج الصوت من الفيديو...'}
              {backendStage === 'generating_subtitles' && 'جاري توليد الترجمات (قد يستغرق عدة دقائق)...'}
              {!backendStage && 'يتم تحضير البيانات وبدء المعالجة'}
            </p>
            
            <div className="max-w-xs mx-auto">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${backendProgress > 0 ? backendProgress : progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-medium text-blue-600">
                  {backendProgress > 0 ? backendProgress : progress}% مكتمل
                </span>
                {(backendProgress >= 100 || progress === 100) && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">تم بنجاح!</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Note about closing modal */}
            {backendProgress > 0 && backendProgress < 100 && (
              <p className="text-xs text-gray-500 mt-3">
                يمكنك إغلاق هذه النافذة - ستستمر المعالجة في الخلفية
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Type Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              نوع المشروع *
            </label>          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProjectType('youtube')}
              disabled={isProcessing}
              className={`p-4 rounded-lg text-sm font-medium transition-colors flex flex-col items-center gap-2 disabled:opacity-50 ${
                projectType === 'youtube'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Youtube className="w-6 h-6" />
              <span>فيديو يوتيوب</span>
            </button>
            <button
              type="button"
              onClick={() => setProjectType('file')}
              disabled={isProcessing}
              className={`p-4 rounded-lg text-sm font-medium transition-colors flex flex-col items-center gap-2 disabled:opacity-50 ${
                projectType === 'file'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FileVideo className="w-6 h-6" />
              <span>رفع ملف</span>
            </button>
          </div>
          </div>

          {/* Project Details */}
          <div className="space-y-4">
            <div>
              <label htmlFor="project-title" className="block text-sm font-medium text-gray-700 mb-2">
                اسم المشروع *
              </label>
              <input
                id="project-title"
                type="text"
                value={projectTitle}
                onChange={(e) => {
                  setProjectTitle(e.target.value);
                  setIsTitleManuallySet(true);
                  // Clear validation error when user starts typing
                  if (validationErrors.title) {
                    setValidationErrors(prev => ({...prev, title: ''}));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="مثال: ترجمة محاضرة التسويق الرقمي"
                disabled={isProcessing}
              />
              {validationErrors.title && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 mb-2">
                وصف المشروع (اختياري)
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

          {/* YouTube URL Section */}
          {projectType === 'youtube' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700">
                  رابط فيديو يوتيوب *
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Youtube className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500 w-5 h-5" />
                    <input
                      id="youtube-url"
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => {
                        setYoutubeUrl(e.target.value);
                        // Clear validation errors when user starts typing
                        if (validationErrors.youtube) {
                          setValidationErrors(prev => ({...prev, youtube: ''}));
                        }
                        if (videoInfoError) {
                          setVideoInfoError(null);
                        }
                      }}
                      className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                        validationErrors.youtube || videoInfoError ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="https://youtube.com/watch?v=..."
                      dir="ltr"
                      disabled={isProcessing}
                    />
                  </div>
                  {/* Manual fetch button - now optional since we auto-fetch */}
                  <button
                    type="button"
                    onClick={handleFetchYouTubeInfo}
                    disabled={isProcessing || isLoadingVideoInfo || !youtubeUrl.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    title="إعادة جلب المعلومات"
                  >
                    {isLoadingVideoInfo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {validationErrors.youtube && (
                  <p className="text-red-600 text-sm">{validationErrors.youtube}</p>
                )}
              </div>

              {/* Error Message */}
              {videoInfoError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{videoInfoError}</p>
                </div>
              )}
              
              {/* Video Information Display - Improved single column layout */}
              {videoInfo && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-gray-900 text-sm flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    معلومات الفيديو:
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600 text-xs">العنوان</span>
                      <p className="font-medium" title={videoInfo.title}>
                        {videoInfo.title}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-600 text-xs">المدة</span>
                        <p className="font-medium">
                          {Math.floor(videoInfo.duration / 60)}:{(videoInfo.duration % 60).toString().padStart(2, '0')} دقيقة
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs">الجودات المتاحة</span>
                        <p className="font-medium">{getAvailableResolutions().length - 1} جودة</p>
                      </div>
                    </div>
                    {videoInfo.uploader && (
                      <div>
                        <span className="text-gray-600 text-xs">القناة</span>
                        <p className="font-medium">{videoInfo.uploader}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Video Resolution & Size Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">جودة الفيديو</label>
                  {resolution && videoInfo?.resolution_sizes && (
                    <span className="text-xs text-gray-600">
                      الحجم المتوقع: {
                        (resolution === 'best'
                          ? videoInfo.resolution_sizes[0]?.human_size
                          : videoInfo.resolution_sizes.find(r => r.resolution === resolution)?.human_size) || 'غير متوفر'
                      }
                    </span>
                  )}
                </div>
                {getAvailableResolutions().length === 0 && (
                  <p className="text-xs text-gray-500">ستظهر الجودات المتاحة بعد إدخال رابط صحيح</p>
                )}
                {getAvailableResolutions().length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {getAvailableResolutions().map(res => {
                      const sizeObj = videoInfo?.resolution_sizes?.find(r => r.resolution === res) || (res === 'best' ? videoInfo?.resolution_sizes?.[0] : undefined);
                      const isRecommended = videoInfo?.recommended_resolution === res;
                      return (
                        <button
                          key={res}
                          type="button"
                          disabled={isProcessing}
                          onClick={() => setResolution(res)}
                          className={`border rounded-lg p-2 text-right transition-colors flex flex-col gap-0.5 ${
                            resolution === res ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          <span className="text-sm font-medium flex items-center gap-1">
                            {res === 'best' ? 'أفضل جودة' : res === 'worst' ? 'أقل جودة' : res}
                            {isRecommended && <span className="text-[10px] bg-blue-600 text-white px-1 rounded">موصى</span>}
                          </span>
                          <span className="text-[11px] text-gray-600">{getResolutionLabel(res)}</span>
                          {sizeObj && (
                            <span className="text-[11px] text-gray-800 font-semibold">{sizeObj.human_size}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  جودة أعلى = حجم أكبر ووقت تنزيل أطول، لكن وضوح أفضل. اختر ما يناسب احتياجك.
                </p>
                {/* Hidden native select for accessibility / fallback */}
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="sr-only"
                  aria-label="اختيار الدقة"
                >
                  {getAvailableResolutions().map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          {projectType === 'file' && (
            <div>
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : validationErrors.file 
                    ? 'border-red-300 bg-red-50'
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
              {validationErrors.file && (
                <p className="mt-2 text-sm text-red-600">{validationErrors.file}</p>
              )}
            </div>
          )}

          {/* Language Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              لغة التفريغ النصي
            </label>
            <SearchableLanguageSelect
              value={projectLanguage}
              onChange={setProjectLanguage}
              disabled={isProcessing}
              includeAuto={true}
            />
            <p className="text-xs text-gray-500">
              اختر لغة الفيديو للتفريغ النصي أو استخدم الكشف التلقائي
            </p>
          </div>

          {/* Audio Language Selection (YouTube only) */}
          {projectType === 'youtube' && videoInfo?.available_audio_languages && videoInfo.available_audio_languages.length > 1 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                لغة الصوت (للفيديوهات متعددة اللغات)
              </label>
              <select
                value={audioLanguage}
                onChange={(e) => setAudioLanguage(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                {videoInfo.available_audio_languages.map((lang) => {
                  const isOriginal = lang === videoInfo.original_audio_language || lang.startsWith(videoInfo.original_audio_language || '');
                  const baseCode = lang.split('-')[0];
                  const langName = LANGUAGE_MAP[lang] || LANGUAGE_MAP[baseCode] || lang;
                  
                  return (
                    <option key={lang} value={lang}>
                      {langName}{isOriginal ? ' (اللغة الأصلية)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-500">
                هذا الفيديو يحتوي على صوتيات بلغات متعددة. اختر اللغة المفضلة لتحميل الصوت
              </p>
            </div>
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
              disabled={isProcessing}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              title={
                !projectTitle.trim() ? 'يرجى إدخال اسم المشروع' :
                projectType === 'file' && !selectedFile ? 'يرجى اختيار ملف فيديو' :
                projectType === 'youtube' && !youtubeUrl.trim() ? 'يرجى إدخال رابط يوتيوب' :
                ''
              }
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
