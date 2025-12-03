import React from 'react';
import { ArrowLeft, Share2, Download, Home, Maximize2, FileText, Loader2, RefreshCw, Languages } from 'lucide-react';

interface VideoPlayerHeaderProps {
  projectTitle: string;
  videoTitle: string;
  currentTime: number;
  duration: number;
  subtitleCount: number;
  isExporting: boolean;
  onBackToHome: () => void;
  onRegenerateCaptions?: () => void;
  onRetranscribe?: () => void;
  onExport: () => void;
  onExportVideo: () => void;
  onShare?: () => void;
  onFullscreen?: () => void;
}

const VideoPlayerHeader: React.FC<VideoPlayerHeaderProps> = ({
  projectTitle,
  videoTitle,
  currentTime,
  duration,
  subtitleCount,
  isExporting,
  onBackToHome,
  onRegenerateCaptions,
  onRetranscribe,
  onExport,
  onExportVideo,
  onShare,
  onFullscreen
}) => {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left Section - Back Button & Project Info */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <Home className="w-4 h-4" />
          </button>
          
          <div className="border-r border-gray-300 pr-4">
            <h1 className="text-lg font-bold text-gray-900 truncate max-w-md" title={projectTitle}>
              {projectTitle}
            </h1>
            <p className="text-sm text-gray-600 truncate max-w-md" title={videoTitle}>
              {videoTitle}
            </p>
          </div>
          
          {/* Progress Info */}
          <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <span className="text-blue-600 font-medium">{subtitleCount}</span>
              <span>ترجمة</span>
            </div>
          </div>
        </div>

        {/* Right Section - Action Buttons */}
        <div className="flex items-center gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
              title="مشاركة"
            >
              <Share2 className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={onExport}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
            title="تصدير ملف الترجمة (SRT)"
          >
            <FileText className="w-5 h-5" />
          </button>
          
          <button
            onClick={onExportVideo}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            title="تصدير الفيديو مع الترجمة"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">{isExporting ? "جاري التصدير..." : "تصدير الفيديو"}</span>
          </button>
          
          {onRegenerateCaptions && (
            <button
              onClick={onRegenerateCaptions}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-all"
              title="إعادة إنشاء الترجمات"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">تخصيص الترجمة</span>
            </button>
          )}
          
          {onRetranscribe && (
            <button
              onClick={onRetranscribe}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg transition-all"
              title="إعادة التوليد بلغة مختلفة"
            >
              <Languages className="w-4 h-4" />
              <span className="hidden sm:inline">إعادة التوليد</span>
            </button>
          )}
          
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
              title="ملء الشاشة"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Mobile Progress Bar */}
      <div className="md:hidden mt-3 flex items-center gap-3 text-sm text-gray-500">
        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono whitespace-nowrap">{formatTime(currentTime)} / {formatTime(duration)}</span>
        <span className="whitespace-nowrap">{subtitleCount} ترجمة</span>
      </div>
    </div>
  );
};

export default VideoPlayerHeader;
