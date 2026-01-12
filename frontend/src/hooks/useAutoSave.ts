import { useCallback, useRef, useEffect } from 'react';
import { Subtitle } from '../types';
import { projectService } from '../services/projectService';

interface UseAutoSaveOptions {
  projectId: string | null;
  subtitles: Subtitle[];
  arabicSubtitles?: Subtitle[];
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: any) => void;
  debounceMs?: number;
}

export const useAutoSave = ({
  projectId,
  subtitles,
  arabicSubtitles = [],
  onSaveStart,
  onSaveComplete,
  onSaveError,
  debounceMs = 1000
}: UseAutoSaveOptions) => {
  const saveTimeoutRef = useRef<number>();
  const lastSavedRef = useRef<string>('');
  const lastArabicSavedRef = useRef<string>('');
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
    if (!projectId || isSavingRef.current) {
      return;
    }

    const currentHash = getSubtitlesHash(subtitles);
    const currentArabicHash = getSubtitlesHash(arabicSubtitles);
    
    const hasSourceChanges = subtitles.length > 0 && currentHash !== lastSavedRef.current;
    const hasArabicChanges = arabicSubtitles.length > 0 && currentArabicHash !== lastArabicSavedRef.current;
    
    if (!hasSourceChanges && !hasArabicChanges) {
      return; // No changes to save
    }

    try {
      isSavingRef.current = true;
      onSaveStart?.();

      // Save source subtitles if changed
      if (hasSourceChanges) {
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
      }

      // Save Arabic subtitles if changed
      if (hasArabicChanges) {
        const backendArabicSubtitles = arabicSubtitles.map((subtitle) => ({
          start_time: subtitle.start_time,
          end_time: subtitle.end_time,
          text: subtitle.originalText || subtitle.text,
          confidence: subtitle.confidence || 1.0
        }));

        await projectService.updateArabicSubtitles(projectId, backendArabicSubtitles);
        lastArabicSavedRef.current = currentArabicHash;
      }

      onSaveComplete?.();
    } catch (error) {
      onSaveError?.(error);
    } finally {
      isSavingRef.current = false;
    }
  }, [projectId, subtitles, arabicSubtitles, getSubtitlesHash, onSaveStart, onSaveComplete, onSaveError]);

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

  // Auto-save when subtitles change (source or Arabic)
  useEffect(() => {
    if (subtitles.length > 0 || arabicSubtitles.length > 0) {
      triggerAutoSave();
    }
  }, [subtitles, arabicSubtitles, triggerAutoSave]);

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
