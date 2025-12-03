import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume, Volume1, Volume2, VolumeX, Maximize, SkipBack, SkipForward, Captions, CaptionsOff, Gauge, Languages } from 'lucide-react';
import { Subtitle } from '../types';
import { formatTime } from '../utils/exportUtils';
import { useSubtitleConfig } from '../hooks/useSubtitleConfig';

interface VideoPlayerProps {
  videoSrc?: string;
  videoFile?: File;
  subtitles: Subtitle[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onFullscreen?: () => void;
  // Optional ISO-like language codes for badge labels (e.g., 'EN', 'AR')
  sourceLangCode?: string;
  targetLangCode?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  videoFile,
  subtitles,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  sourceLangCode,
  targetLangCode = 'AR',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [showSubtitles, setShowSubtitles] = useState(true);
  // Two-state language toggle: false = source, true = target (translated)
  const [showTranslated, setShowTranslated] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('torgman_show_translated');
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [intrinsicSize, setIntrinsicSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [renderedSize, setRenderedSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  
  // Use global subtitle configuration
  const { config: subtitleConfig } = useSubtitleConfig();

  // Persist toggle choice
  useEffect(() => {
    try {
      localStorage.setItem('torgman_show_translated', showTranslated ? '1' : '0');
    } catch {}
  }, [showTranslated]);

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
      // Capture intrinsic video dimensions
      setIntrinsicSize({ width: videoRef.current.videoWidth || 0, height: videoRef.current.videoHeight || 0 });
      // Capture rendered size
      const rect = videoRef.current.getBoundingClientRect();
      setRenderedSize({ width: rect.width, height: rect.height });
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

  // Track rendered video element size (on resize and metadata load)
  useEffect(() => {
    const updateRendered = () => {
      if (!videoRef.current) return;
      const rect = videoRef.current.getBoundingClientRect();
      setRenderedSize({ width: rect.width, height: rect.height });
    };
    updateRendered();
    window.addEventListener('resize', updateRendered);
    return () => window.removeEventListener('resize', updateRendered);
  }, []);

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

  // Resolve displayed text based on toggle
  const getDisplayedText = useCallback(() => {
    if (!currentSubtitle) return '';
    if (showTranslated) {
      // Show translated text only if it exists, otherwise show nothing
      return currentSubtitle.translatedText || currentSubtitle.translation || '';
    }
    // Source/original
    return currentSubtitle.originalText || currentSubtitle.text || '';
  }, [currentSubtitle, showTranslated]);

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

  // Compute scale factor between rendered and intrinsic height to align preview with export baseline
  const heightScale = React.useMemo(() => {
    const iw = intrinsicSize.width || 0;
    const ih = intrinsicSize.height || 0;
    const rw = renderedSize.width || 0;
    const rh = renderedSize.height || 0;
    if (!iw || !ih || !rw || !rh) return 1;
    const scale = Math.min(rw / iw, rh / ih);
    return scale > 0 && Number.isFinite(scale) ? scale : 1;
  }, [intrinsicSize.width, intrinsicSize.height, renderedSize.width, renderedSize.height]);

  const computePx = (value?: number) => {
    if (value == null) return 0;
    return Math.round(value * heightScale);
  };

  const parseFontPx = (val?: string) => {
    if (!val) return 28;
    const n = parseFloat(String(val).replace('px', '').replace('pt', ''));
    return Number.isFinite(n) ? n : 28;
  };

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
        case 'l':
        case 'L':
          e.preventDefault();
          setShowTranslated(prev => !prev);
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
              fontSize: `${computePx(parseFontPx(subtitleConfig.fontSize))}px`,
              fontWeight: subtitleConfig.fontWeight,
              color: subtitleConfig.color,
              backgroundColor: subtitleConfig.backgroundColor,
              textAlign: 'center',
              padding: subtitleConfig.padding,
              borderRadius: subtitleConfig.borderRadius,
              lineHeight: subtitleConfig.lineHeight,
              maxWidth: subtitleConfig.maxWidth,
              margin: `${computePx(subtitleConfig.margin.top ?? subtitleConfig.margin.vertical ?? 10)}px ${computePx(subtitleConfig.margin.right)}px ${computePx(subtitleConfig.margin.bottom ?? subtitleConfig.margin.vertical ?? 10)}px ${computePx(subtitleConfig.margin.left)}px`,
              whiteSpace: 'pre-wrap' as const,
              direction: 'rtl' as const
            }}
          >
            <div>{getDisplayedText()}</div>
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
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : volume < 0.34 ? (
                  <Volume className="w-4 h-4" />
                ) : volume < 0.67 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
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
            
            {/* Subtitle Visibility Toggle */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                showSubtitles ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/20'
              }`}
              title={showSubtitles ? 'إخفاء الترجمات' : 'إظهار الترجمات'}
              aria-label={showSubtitles ? 'إخفاء الترجمات' : 'إظهار الترجمات'}
            >
              {showSubtitles ? (
                <Captions className="w-4 h-4" />
              ) : (
                <CaptionsOff className="w-4 h-4" />
              )}
            </button>

            {/* Language Toggle (Source <-> Target) */}
            <button
              onClick={() => setShowTranslated(prev => !prev)}
              className={`p-2 rounded-lg transition-all duration-200 relative ${
                showTranslated ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/20'
              }`}
              title={showTranslated ? 'عرض الأصل' : 'عرض الترجمة'}
              aria-label={showTranslated ? 'عرض الأصل' : 'عرض الترجمة'}
            >
              <Languages className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[10px] rounded px-1 py-0.5 leading-none font-bold">
                {(() => {
                  // Normalize codes to short uppercase labels for badge
                  const normalize = (code: string | undefined, fallback: string) => {
                    if (!code) return fallback;
                    // Accept formats like 'en', 'en-US', 'english'
                    const lowered = code.trim().toLowerCase();
                    // If hyphenated like en-us take first part
                    const base = lowered.split(/[-_]/)[0];
                    // Known mappings (extend if needed)
                    const map: Record<string, string> = {
                      english: 'EN',
                      arabic: 'AR',
                      ar: 'AR',
                      en: 'EN',
                      fr: 'FR',
                      es: 'ES',
                      de: 'DE',
                      it: 'IT',
                      ja: 'JA',
                      zh: 'ZH'
                    };
                    if (map[base]) return map[base];
                    // Fallback: take first two letters
                    return base.slice(0, 2).toUpperCase();
                  };
                  const src = normalize(sourceLangCode, '??');
                  const tgt = normalize(targetLangCode, 'AR');
                  return showTranslated ? tgt : src;
                })()}
              </span>
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
    </div>
  );
};

export default VideoPlayer;