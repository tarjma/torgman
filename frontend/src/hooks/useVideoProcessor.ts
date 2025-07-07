import { useState, useCallback } from 'react';
import { VideoInfo } from '../types';
import { youtubeService } from '../services/youtubeService';

export const useVideoProcessor = () => {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const extractYouTubeTitle = useCallback(async (url: string): Promise<string> => {
    try {
      setError(null);
      const videoInfo = await youtubeService.getVideoInfo(url);
      return videoInfo.title || 'YouTube Video';
    } catch (error) {
      console.error('Error extracting YouTube title:', error);
      setError(error instanceof Error ? error.message : 'Failed to extract video info');
      return 'YouTube Video'; // Fallback title
    }
  }, []);

  const processVideoFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Create video element to get duration
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      
      return new Promise<VideoInfo>((resolve, reject) => {
        video.onloadedmetadata = () => {
          const info: VideoInfo = {
            file,
            duration: video.duration,
            title: file.name.replace(/\.[^/.]+$/, ''),
            language: 'auto-detect'
          };
          
          setVideoInfo(info);
          setProgress(100);
          setIsProcessing(false);
          URL.revokeObjectURL(url);
          resolve(info);
        };
        
        video.onerror = () => {
          setIsProcessing(false);
          URL.revokeObjectURL(url);
          reject(new Error('Failed to process video file'));
        };
        
        video.src = url;
      });
    } catch (error) {
      setIsProcessing(false);
      throw error;
    }
  }, []);

  const processYouTubeUrl = useCallback(async (url: string) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      // Get video info from backend
      const videoData = await youtubeService.getVideoInfo(url);
      
      const info: VideoInfo = {
        url,
        duration: videoData.duration,
        title: videoData.title,
        language: 'auto-detect'
      };
      
      setVideoInfo(info);
      setProgress(100);
      setIsProcessing(false);
      
      return info;
    } catch (error) {
      console.error('Error processing YouTube URL:', error);
      setError(error instanceof Error ? error.message : 'Failed to process YouTube URL');
      setIsProcessing(false);
      throw error;
    }
  }, []);

  return {
    videoInfo,
    isProcessing,
    progress,
    error,
    processVideoFile,
    processYouTubeUrl,
    setVideoInfo,
    extractYouTubeTitle
  };
};