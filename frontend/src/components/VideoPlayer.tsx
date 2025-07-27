import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, Settings, Subtitles, Gauge } from 'lucide-react';
import { Subtitle } from '../types';
import { formatTime } from '../utils/exportUtils';
import { useSubtitleConfig } from '../hooks/useSubtitleConfig';
import SubtitleConfigModal from './SubtitleConfigModal';

interface VideoPlayerProps {
  videoSrc?: string;
  videoFile?: File;
  subtitles: Subtitle[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onFullscreen?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  videoFile,
  subtitles,
  currentTime,
  onTimeUpdate,
  onDurationChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitleConfig, setShowSubtitleConfig] = useState(false);
  
  // Use global subtitle configuration
  const { config: subtitleConfig } = useSubtitleConfig();

  // Create video URL from file
  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (videoSrc) {
      setVideoUrl(videoSrc);
    }
  }, [videoFile, videoSrc]);

  // Video event handlers
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const newDuration = videoRef.current.duration;
      setDuration(newDuration);
      onDurationChange?.(newDuration);
    }
  }, [onDurationChange]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  }, [onTimeUpdate]);

  // Sync video time with external currentTime changes
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && videoRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const newTime = pos * duration;
      videoRef.current.currentTime = newTime;
      onTimeUpdate(newTime);
    }
  }, [duration, onTimeUpdate]);

  const skipTime = useCallback((seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
      onTimeUpdate(newTime);
    }
  }, [duration, onTimeUpdate]);

  const changePlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSettings(false);
  }, []);

  // Get current subtitle (fixed property names)
  const currentSubtitle = subtitles.find(sub => 
    currentTime >= sub.start_time && currentTime <= sub.end_time
  );

  const toggleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen().catch((err) => {
          console.error('Error attempting to enable fullscreen:', err);
        });
      }
    }
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts if video is focused or if no input is focused
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipTime(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipTime(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setShowSubtitles(!showSubtitles);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [togglePlay, skipTime, handleVolumeChange, volume, toggleMute, showSubtitles, toggleFullscreen]);

  return (
    <div ref={containerRef} className="bg-black h-full flex flex-col">
      {/* Video Area - Takes available space minus controls */}
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain bg-black"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {/* Subtitle Overlay */}
        {showSubtitles && currentSubtitle && subtitleConfig && (
          <div 
            className={`absolute z-0 transition-opacity duration-300 ${
              subtitleConfig.position === 'top-center' ? 'top-0' :
              subtitleConfig.position === 'center' ? 'top-1/2 -translate-y-1/2' :
              'bottom-0'
            } left-1/2 transform -translate-x-1/2`}
            style={{
              fontFamily: subtitleConfig.fontFamily,
              fontSize: subtitleConfig.fontSize,
              fontWeight: subtitleConfig.fontWeight,
              color: subtitleConfig.color,
              backgroundColor: subtitleConfig.backgroundColor,
              textAlign: 'center',
              padding: subtitleConfig.padding,
              borderRadius: subtitleConfig.borderRadius,
              textShadow: subtitleConfig.textShadow,
              lineHeight: subtitleConfig.lineHeight,
              maxWidth: subtitleConfig.maxWidth,
              margin: `${subtitleConfig.margin.top}px ${subtitleConfig.margin.right}px ${subtitleConfig.margin.bottom}px ${subtitleConfig.margin.left}px`,
              whiteSpace: 'pre-wrap' as const,
              direction: 'rtl' as const
            }}
          >
            <div>
              {currentSubtitle.translatedText || currentSubtitle.text || currentSubtitle.originalText}
            </div>
          </div>
        )}

        {/* Play/Pause Overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer group z-0"
          onClick={togglePlay}
        >
          <div className={`bg-black bg-opacity-50 rounded-full p-4 transition-opacity ${
            isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
          }`}>
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </div>
        </div>
      </div>

      {/* Video Controls - Fixed height, always visible */}
      <div className="bg-black p-4 space-y-3 z-10 relative border-t border-gray-600 flex-shrink-0" dir="ltr">
        {/* Progress Bar */}
        <div 
          ref={progressRef}
          className="relative h-2 bg-white/20 rounded-full cursor-pointer group"
          onClick={handleSeek}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-150 shadow-lg"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div 
            className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-grab active:cursor-grabbing"
            style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => skipTime(-10)}
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 group"
              title="ترجع 10 ثوان"
            >
              <SkipBack className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
            
            <button
              onClick={togglePlay}
              className="p-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
            </button>
            
            <button
              onClick={() => skipTime(10)}
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 group"
              title="تقدم 10 ثوان"
            >
              <SkipForward className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm font-mono text-gray-300 bg-black/30 px-3 py-1 rounded-full">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            
            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
                title="إعدادات السرعة"
              >
                <Gauge className="w-4 h-4" />
              </button>
              {showSettings && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 bg-black/90 backdrop-blur-sm rounded-xl p-4 min-w-[140px] shadow-xl border border-white/10">
                  <div className="text-sm font-medium mb-3 text-center text-white">السرعة</div>
                  <div className="space-y-2">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`w-full px-4 py-2 rounded-lg text-sm transition-all ${
                          playbackRate === rate 
                            ? 'bg-blue-600 text-white font-medium' 
                            : 'hover:bg-white/10 text-gray-300'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Volume Control */}
            <div className="flex items-center space-x-2">
              <button 
                onClick={toggleMute} 
                className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
                title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none slider"
              />
            </div>
            
            {/* Subtitle Toggle */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-2 rounded-lg transition-all duration-200 relative ${
                showSubtitles ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/20'
              }`}
              title={`${showSubtitles ? 'إخفاء' : 'إظهار'} الترجمات (${subtitles.length})`}
            >
              <Subtitles className="w-4 h-4" />
              {subtitles.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                  {subtitles.length}
                </span>
              )}
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
              title="ملء الشاشة"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Subtitle Configuration Modal */}
      <SubtitleConfigModal 
        isOpen={showSubtitleConfig} 
        onClose={() => setShowSubtitleConfig(false)} 
      />
    </div>
  );
};

export default VideoPlayer;