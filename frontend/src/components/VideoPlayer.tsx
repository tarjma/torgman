import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, Settings, Subtitles } from 'lucide-react';
import { Subtitle } from '../types';
import { formatTime } from '../utils/exportUtils';

interface VideoPlayerProps {
  videoSrc?: string;
  videoFile?: File;
  subtitles: Subtitle[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  videoFile,
  subtitles,
  currentTime,
  onTimeUpdate,
  onDurationChange
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

  // Get current subtitle
  const currentSubtitle = subtitles.find(sub => 
    currentTime >= sub.startTime && currentTime <= sub.endTime
  );

  const toggleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  }, []);

  return (
    <div className="bg-black h-full flex flex-col rounded-lg overflow-hidden">
      <div className="relative flex-1">
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
        {showSubtitles && currentSubtitle && (
          <div 
            className="absolute bottom-16 left-1/2 transform -translate-x-1/2 px-4 py-2 text-center max-w-[80%]"
            style={{
              fontFamily: currentSubtitle.styling.fontFamily,
              fontSize: `${Math.max(currentSubtitle.styling.fontSize, 16)}px`,
              color: currentSubtitle.styling.color,
              backgroundColor: currentSubtitle.styling.backgroundColor,
              fontWeight: currentSubtitle.styling.bold ? 'bold' : 'normal',
              fontStyle: currentSubtitle.styling.italic ? 'italic' : 'normal',
              textShadow: currentSubtitle.styling.outline 
                ? `2px 2px 0 ${currentSubtitle.styling.outlineColor}, -2px -2px 0 ${currentSubtitle.styling.outlineColor}, 2px -2px 0 ${currentSubtitle.styling.outlineColor}, -2px 2px 0 ${currentSubtitle.styling.outlineColor}` 
                : '1px 1px 2px rgba(0,0,0,0.8)',
              direction: 'rtl',
              borderRadius: '4px'
            }}
          >
            {currentSubtitle.translatedText || currentSubtitle.originalText}
          </div>
        )}

        {/* Play/Pause Overlay */}
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer group"
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

      {/* Video Controls */}
      <div className="bg-gray-900 p-4 space-y-3" dir="ltr">
        {/* Progress Bar */}
        <div 
          ref={progressRef}
          className="relative h-2 bg-gray-600 rounded cursor-pointer group"
          onClick={handleSeek}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-blue-500 rounded transition-all duration-150"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div 
            className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => skipTime(-10)}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            
            <button
              onClick={togglePlay}
              className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            
            <button
              onClick={() => skipTime(10)}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-sm font-mono text-gray-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            
            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              {showSettings && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 rounded-lg p-3 min-w-[120px]">
                  <div className="text-sm font-medium mb-2 text-center">السرعة</div>
                  <div className="space-y-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`w-full px-3 py-1 rounded text-sm transition-colors ${
                          playbackRate === rate ? 'bg-blue-600' : 'hover:bg-gray-700'
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
                className="p-2 hover:bg-gray-700 rounded transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 accent-blue-500"
              />
            </div>
            
            {/* Subtitle Toggle */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-2 rounded transition-colors ${
                showSubtitles ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
              }`}
            >
              <Subtitles className="w-5 h-5" />
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;