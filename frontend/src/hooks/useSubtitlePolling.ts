import { useEffect, useCallback } from 'react';
import { projectService } from '../services/projectService';
import { Subtitle } from '../types';

export const useSubtitlePolling = (
  projectId: string | null,
  isTranslating: boolean,
  onSubtitlesUpdate: (subtitles: Subtitle[]) => void
) => {
  const pollSubtitles = useCallback(async () => {
    if (!projectId) return;
    
    try {
      console.log('Polling for subtitle updates...');
      const backendSubtitles = await projectService.getProjectSubtitles(projectId);
      
      // Convert backend subtitles to frontend format
      const frontendSubtitles: Subtitle[] = backendSubtitles.map((sub, index) => ({
        id: `${projectId}_subtitle_${index}`,
        start_time: sub.start,
        end_time: sub.end,
        text: sub.text,
        originalText: sub.text,
        translatedText: sub.translation || '',
        position: { x: 50, y: 80 },
        styling: {
          fontFamily: 'Noto Sans Arabic, Arial, sans-serif',
          fontSize: 20,
          color: '#ffffff',
          backgroundColor: '#000000',
          opacity: 1,
          outline: true,
          outlineColor: '#000000',
          bold: false,
          italic: false,
          alignment: 'center' as const
        }
      }));
      
      console.log('Polled subtitles:', frontendSubtitles);
      onSubtitlesUpdate(frontendSubtitles);
    } catch (error) {
      console.error('Error polling subtitles:', error);
    }
  }, [projectId, onSubtitlesUpdate]);

  useEffect(() => {
    if (!isTranslating || !projectId) return;
    
    console.log('Starting subtitle polling due to translation in progress');
    
    // Poll every 5 seconds during translation
    const pollInterval = setInterval(pollSubtitles, 5000);
    
    // Also poll immediately
    pollSubtitles();
    
    return () => {
      console.log('Stopping subtitle polling');
      clearInterval(pollInterval);
    };
  }, [isTranslating, projectId, pollSubtitles]);
};
