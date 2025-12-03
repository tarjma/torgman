import React, { useState, useCallback, useEffect } from 'react';
import { X, Upload, Youtube, FileVideo, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Project } from '../types';
import { youtubeService, YouTubeVideoInfo } from '../services/youtubeService';
import SearchableLanguageSelect, { LANGUAGE_MAP } from './SearchableLanguageSelect';

// Move constants outside component for better performance
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;

type ProjectType = 'youtube' | 'file';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>, videoFile?: File, youtubeUrl?: string, resolution?: string, videoInfo?: YouTubeVideoInfo, language?: string, audioLanguage?: string) => Promise<void>;
  isProcessing: boolean;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  isProcessing
}) => {
  const [projectType, setProjectType] = useState<ProjectType>('youtube');
  const [projectTitle, setProjectTitle] = useState('');
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

  const resetForm = useCallback(() => {
    setProjectType('youtube');
    setProjectTitle('');
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
  }, [projectTitle, projectType, selectedFile, youtubeUrl, videoInfo, resolution, projectLanguage, audioLanguage, onCreateProject]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-l from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <FileVideo className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">مشروع جديد</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              اختر مصدر الفيديو
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setProjectType('youtube')}
                disabled={isProcessing}
                className={`group relative p-5 rounded-xl text-sm font-medium transition-all duration-200 flex flex-col items-center gap-3 disabled:opacity-50 border-2 ${
                  projectType === 'youtube'
                    ? 'border-red-500 bg-red-50 shadow-lg shadow-red-100'
                    : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  projectType === 'youtube'
                    ? 'bg-red-600'
                    : 'bg-gray-100 group-hover:bg-red-100'
                }`}>
                  <Youtube className={`w-6 h-6 ${
                    projectType === 'youtube' ? 'text-white' : 'text-red-600'
                  }`} />
                </div>
                <span className={projectType === 'youtube' ? 'text-red-700 font-semibold' : 'text-gray-700'}>يوتيوب</span>
                {projectType === 'youtube' && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setProjectType('file')}
                disabled={isProcessing}
                className={`group relative p-5 rounded-xl text-sm font-medium transition-all duration-200 flex flex-col items-center gap-3 disabled:opacity-50 border-2 ${
                  projectType === 'file'
                    ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  projectType === 'file'
                    ? 'bg-blue-600'
                    : 'bg-gray-100 group-hover:bg-blue-100'
                }`}>
                  <Upload className={`w-6 h-6 ${
                    projectType === 'file' ? 'text-white' : 'text-blue-600'
                  }`} />
                </div>
                <span className={projectType === 'file' ? 'text-blue-700 font-semibold' : 'text-gray-700'}>رفع ملف</span>
                {projectType === 'file' && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Project Title */}
          <div>
            <label htmlFor="project-title" className="block text-sm font-medium text-gray-700 mb-2">
              اسم المشروع
            </label>
            <input
              id="project-title"
              type="text"
              value={projectTitle}
              onChange={(e) => {
                setProjectTitle(e.target.value);
                setIsTitleManuallySet(true);
                if (validationErrors.title) {
                  setValidationErrors(prev => ({...prev, title: ''}));
                }
              }}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                validationErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              placeholder="سيتم تعبئته تلقائياً من عنوان الفيديو..."
              disabled={isProcessing}
            />
            {validationErrors.title && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <span className="inline-block w-1 h-1 bg-red-500 rounded-full" />
                {validationErrors.title}
              </p>
            )}
          </div>

          {/* YouTube URL Section */}
          {projectType === 'youtube' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700">
                  رابط الفيديو
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <Youtube className="text-red-600 w-4 h-4" />
                    </div>
                    <input
                      id="youtube-url"
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => {
                        setYoutubeUrl(e.target.value);
                        if (validationErrors.youtube) {
                          setValidationErrors(prev => ({...prev, youtube: ''}));
                        }
                        if (videoInfoError) {
                          setVideoInfoError(null);
                        }
                      }}
                      className={`w-full pr-14 pl-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all ${
                        validationErrors.youtube || videoInfoError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      placeholder="الصق رابط يوتيوب هنا..."
                      dir="ltr"
                      disabled={isProcessing}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchYouTubeInfo}
                    disabled={isProcessing || isLoadingVideoInfo || !youtubeUrl.trim()}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 border-2 border-gray-200"
                    title="إعادة جلب المعلومات"
                  >
                    {isLoadingVideoInfo ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {validationErrors.youtube && (
                  <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                    <span className="inline-block w-1 h-1 bg-red-500 rounded-full" />
                    {validationErrors.youtube}
                  </p>
                )}
              </div>

              {/* Error Message */}
              {videoInfoError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{videoInfoError}</p>
                </div>
              )}
              
              {/* Video Information Display */}
              {videoInfo && (
                <div className="bg-gradient-to-l from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 line-clamp-2" title={videoInfo.title}>
                        {videoInfo.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          🕐 {Math.floor(videoInfo.duration / 60)}:{(videoInfo.duration % 60).toString().padStart(2, '0')}
                        </span>
                        <span className="flex items-center gap-1">
                          📺 {getAvailableResolutions().length - 1} جودة
                        </span>
                        {videoInfo.uploader && (
                          <span className="flex items-center gap-1">
                            👤 {videoInfo.uploader}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Video Resolution & Size Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">جودة التحميل</label>
                  {resolution && videoInfo?.resolution_sizes && (
                    <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {
                        (resolution === 'best'
                          ? videoInfo.resolution_sizes[0]?.human_size
                          : videoInfo.resolution_sizes.find(r => r.resolution === resolution)?.human_size) || ''
                      }
                    </span>
                  )}
                </div>
                {getAvailableResolutions().length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    ستظهر الجودات المتاحة بعد إدخال رابط صحيح
                  </div>
                )}
                {getAvailableResolutions().length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {getAvailableResolutions().map(res => {
                      const sizeObj = videoInfo?.resolution_sizes?.find(r => r.resolution === res) || (res === 'best' ? videoInfo?.resolution_sizes?.[0] : undefined);
                      const isRecommended = videoInfo?.recommended_resolution === res;
                      const isSelected = resolution === res;
                      return (
                        <button
                          key={res}
                          type="button"
                          disabled={isProcessing}
                          onClick={() => setResolution(res)}
                          className={`relative border-2 rounded-xl p-3 text-right transition-all flex flex-col gap-1 ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50 shadow-sm' 
                              : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          <span className="text-sm font-semibold flex items-center gap-1.5">
                            {res === 'best' ? '✨ أفضل' : res === 'worst' ? 'أقل' : res}
                            {isRecommended && <span className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded-full">موصى</span>}
                          </span>
                          {sizeObj && (
                            <span className="text-xs text-gray-600">{sizeObj.human_size}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                    : validationErrors.file 
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
                } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="space-y-4">
                  {selectedFile ? (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                        <FileVideo className="w-8 h-8 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-lg">{selectedFile.name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          📁 {(selectedFile.size / (1024 * 1024)).toFixed(1)} ميجابايت
                        </p>
                      </div>
                      {!isProcessing && (
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          ✕ إزالة الملف
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
                        <Upload className="w-8 h-8 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-gray-900 font-semibold text-lg">اسحب وأفلت الفيديو هنا</p>
                        <p className="text-gray-500 mt-1">أو انقر للاختيار</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-400">
                        <span className="bg-gray-100 px-2 py-1 rounded">MP4</span>
                        <span className="bg-gray-100 px-2 py-1 rounded">AVI</span>
                        <span className="bg-gray-100 px-2 py-1 rounded">MOV</span>
                        <span className="bg-gray-100 px-2 py-1 rounded">MKV</span>
                        <span className="bg-gray-100 px-2 py-1 rounded">حتى 500MB</span>
                      </div>
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
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 bg-red-500 rounded-full" />
                  {validationErrors.file}
                </p>
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
          <div className="flex gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 bg-gradient-to-l from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-semibold shadow-lg shadow-blue-200"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  إنشاء المشروع
                  <span className="text-blue-200">←</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
