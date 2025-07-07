import React, { useCallback, useState } from 'react';
import { Upload, Youtube, FileVideo, Loader2, Cloud } from 'lucide-react';

interface VideoUploadProps {
  onVideoFile: (file: File) => void;
  onYouTubeUrl: (url: string) => void;
  isProcessing: boolean;
  progress: number;
}

const VideoUpload: React.FC<VideoUploadProps> = ({
  onVideoFile,
  onYouTubeUrl,
  isProcessing,
  progress
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'youtube'>('file');

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
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        onVideoFile(file);
      }
    }
  }, [onVideoFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onVideoFile(files[0]);
    }
  }, [onVideoFile]);

  const handleYouTubeSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (youtubeUrl.trim()) {
      onYouTubeUrl(youtubeUrl.trim());
    }
  }, [youtubeUrl, onYouTubeUrl]);

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-white rounded-2xl border border-gray-200 shadow-soft">
        <div className="relative mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
            <Cloud className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 absolute -top-1 -right-1 bg-white rounded-full" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">جاري معالجة الفيديو...</h3>
        <p className="text-gray-600 text-center mb-6">يتم استخراج الصوت وتحليل المحتوى</p>
        <div className="w-80 bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-3 font-medium">{progress}% مكتمل</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mode Selection */}
      <div className="flex justify-center">
        <div className="bg-white p-1.5 rounded-2xl shadow-soft border border-gray-200 flex">
          <button
            onClick={() => setUploadMode('file')}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              uploadMode === 'file'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            <FileVideo className="w-4 h-4" />
            رفع ملف فيديو
          </button>
          <button
            onClick={() => setUploadMode('youtube')}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              uploadMode === 'youtube'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md'
                : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
            }`}
          >
            <Youtube className="w-4 h-4" />
            رابط يوتيوب
          </button>
        </div>
      </div>

      {uploadMode === 'file' ? (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
            dragActive
              ? 'border-blue-500 bg-blue-50 scale-105'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              رفع ملف الفيديو
            </h3>
            <p className="text-gray-600 mb-4 text-lg">
              اسحب وأفلت ملف الفيديو هنا أو انقر للاختيار
            </p>
            <p className="text-sm text-gray-500 mb-6">
              الصيغ المدعومة: MP4, AVI, MOV, MKV (حد أقصى 500 ميجابايت)
            </p>
          </div>
          
          <input
            type="file"
            accept="video/*"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <button className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-lg">
            اختيار ملف الفيديو
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 shadow-soft border border-gray-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Youtube className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              رابط فيديو اليوتيوب
            </h3>
            <p className="text-gray-600">
              الصق رابط فيديو يوتيوب لاستخراج الترجمات تلقائياً
            </p>
          </div>
          
          <form onSubmit={handleYouTubeSubmit} className="space-y-4">
            <div>
              <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 mb-3">
                رابط الفيديو
              </label>
              <div className="flex gap-3">
                <input
                  id="youtube-url"
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent text-left transition-all duration-200"
                  dir="ltr"
                />
                <button
                  type="submit"
                  disabled={!youtubeUrl.trim()}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-xl hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                >
                  <Youtube className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;