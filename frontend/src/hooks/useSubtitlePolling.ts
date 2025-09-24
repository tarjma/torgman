import { useEffect, useCallback, useRef } from 'react';
import { projectService } from '../services/projectService';
import { Subtitle } from '../types';

export const useSubtitlePolling = (
  projectId: string | null,
  isTranslating: boolean,
  onSubtitlesUpdate: (subtitles: Subtitle[]) => void
) => {
  const callbackRef = useRef(onSubtitlesUpdate);
  useEffect(() => { callbackRef.current = onSubtitlesUpdate; }, [onSubtitlesUpdate]);

  const inFlightRef = useRef(false);

  const pollSubtitles = useCallback(async () => {
    if (!projectId || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const backendSubtitles = await projectService.getProjectSubtitles(projectId);

      // Convert backend subtitles to frontend format with fallback for legacy keys
      const frontendSubtitles: Subtitle[] = backendSubtitles.map((sub: any, index: number) => {
        const startTime = (sub.start_time ?? sub.start ?? 0) * 1; // ensure number
        const endTime = (sub.end_time ?? sub.end ?? startTime) * 1;
        return {
          id: sub.id || `${projectId}_subtitle_${index}`,
          start_time: startTime,
          end_time: endTime,
            // Backend may send 'text' plus optional 'translation'
          text: sub.translation ? sub.translation : sub.text,
          originalText: sub.text,
          translatedText: sub.translation || '',
          position: sub.position || { x: 50, y: 80 },
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
            alignment: 'center'
          }
        };
      });
      
      callbackRef.current(frontendSubtitles);
    } catch (error) {
      console.error('Error polling subtitles:', error);
    } finally {
      inFlightRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    if (!isTranslating || !projectId) return;
    
  // Poll immediately then every 5s
  pollSubtitles();
  const pollInterval = setInterval(pollSubtitles, 5000);
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [isTranslating, projectId, pollSubtitles]);
};
