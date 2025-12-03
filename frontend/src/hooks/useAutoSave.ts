import { useCallback, useRef, useEffect } from 'react';
import { Subtitle } from '../types';
import { projectService } from '../services/projectService';

interface UseAutoSaveOptions {
  projectId: string | null;
  subtitles: Subtitle[];
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: any) => void;
  debounceMs?: number;
}

export const useAutoSave = ({
  projectId,
  subtitles,
  onSaveStart,
  onSaveComplete,
  onSaveError,
  debounceMs = 1000
}: UseAutoSaveOptions) => {
  const saveTimeoutRef = useRef<number>();
  const lastSavedRef = useRef<string>('');
  const isSavingRef = useRef(false);

  // Generate a hash of current subtitles to detect changes
  const getSubtitlesHash = useCallback((subs: Subtitle[]) => {
    return JSON.stringify(subs.map(sub => ({
      id: sub.id,
      start_time: sub.start_time,
      end_time: sub.end_time,
      text: sub.text,
      originalText: sub.originalText,
      translatedText: sub.translatedText,
      styling: sub.styling
    })));
  }, []);

  // Save subtitles to backend
  const saveSubtitles = useCallback(async () => {
    if (!projectId || !subtitles.length || isSavingRef.current) {
      return;
    }

    const currentHash = getSubtitlesHash(subtitles);
    if (currentHash === lastSavedRef.current) {
      return; // No changes to save
    }

    try {
      isSavingRef.current = true;
      onSaveStart?.();

      // Convert frontend subtitles to backend format (now using consistent field names)
      const backendSubtitles = subtitles.map((subtitle) => ({
        start_time: subtitle.start_time,
        end_time: subtitle.end_time,
        text: subtitle.originalText || subtitle.text,
        translation: subtitle.translatedText,
        confidence: subtitle.confidence || 1.0,
        styling: subtitle.styling
      }));

      await projectService.updateProjectSubtitles(projectId, backendSubtitles);
      
      lastSavedRef.current = currentHash;
      onSaveComplete?.();
    } catch (error) {
      onSaveError?.(error);
    } finally {
      isSavingRef.current = false;
    }
  }, [projectId, subtitles, getSubtitlesHash, onSaveStart, onSaveComplete, onSaveError]);

  // Debounced auto-save trigger
  const triggerAutoSave = useCallback(() => {
    if (!projectId) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveSubtitles();
    }, debounceMs);
  }, [projectId, saveSubtitles, debounceMs]);

  // Save immediately (without debounce)
  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveSubtitles();
  }, [saveSubtitles]);

  // Auto-save when subtitles change
  useEffect(() => {
    if (subtitles.length > 0) {
      triggerAutoSave();
    }
  }, [subtitles, triggerAutoSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    triggerAutoSave,
    saveNow,
    isSaving: isSavingRef.current
  };
};
