import { useState, useCallback } from 'react';
import { Subtitle, SubtitleStyling } from '../types';

const defaultStyling: SubtitleStyling = {
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
};

export const useSubtitles = () => {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const addSubtitle = useCallback((startTime: number, endTime: number, text: string = '') => {
    const newSubtitle: Subtitle = {
      id: Date.now().toString(),
      start_time: startTime,
      end_time: endTime,
      text: text,
      originalText: text,
      translatedText: '',
      position: { x: 50, y: 80 },
      styling: { ...defaultStyling }
    };
    
    setSubtitles(prev => [...prev, newSubtitle].sort((a, b) => a.start_time - b.start_time));
    return newSubtitle.id;
  }, []);

  const updateSubtitle = useCallback((id: string, updates: Partial<Subtitle>) => {
    setSubtitles(prev => prev.map(sub => 
      sub.id === id ? { ...sub, ...updates } : sub
    ));
  }, []);

  const deleteSubtitle = useCallback((id: string) => {
    setSubtitles(prev => prev.filter(sub => sub.id !== id));
    if (activeSubtitle === id) {
      setActiveSubtitle(null);
    }
  }, [activeSubtitle]);

  const getCurrentSubtitle = useCallback(() => {
    return subtitles.find(sub => 
      currentTime >= sub.start_time && currentTime <= sub.end_time
    );
  }, [subtitles, currentTime]);

  const duplicateSubtitle = useCallback((id: string) => {
    const subtitle = subtitles.find(sub => sub.id === id);
    if (subtitle) {
      const newSubtitle: Subtitle = {
        ...subtitle,
        id: Date.now().toString(),
        start_time: subtitle.end_time,
        end_time: subtitle.end_time + (subtitle.end_time - subtitle.start_time)
      };
      setSubtitles(prev => [...prev, newSubtitle].sort((a, b) => a.start_time - b.start_time));
    }
  }, [subtitles]);

  const loadSubtitles = useCallback((newSubtitles: Subtitle[]) => {
    console.log('loadSubtitles called with:', newSubtitles);
    setSubtitles(newSubtitles.sort((a, b) => a.start_time - b.start_time));
    console.log('Subtitles loaded, new count:', newSubtitles.length);
  }, []);

  const clearSubtitles = useCallback(() => {
    setSubtitles([]);
    setActiveSubtitle(null);
  }, []);

  // Navigation helper functions
  const findNextSubtitle = useCallback(() => {
    return subtitles.find(sub => sub.start_time > currentTime);
  }, [subtitles, currentTime]);

  const findPreviousSubtitle = useCallback(() => {
    return subtitles.reverse().find(sub => sub.end_time < currentTime);
  }, [subtitles, currentTime]);

  const seekToSubtitle = useCallback((subtitleId: string) => {
    const subtitle = subtitles.find(sub => sub.id === subtitleId);
    if (subtitle) {
      setCurrentTime(subtitle.start_time);
      setActiveSubtitle(subtitleId);
      return subtitle.start_time;
    }
    return null;
  }, [subtitles]);

  const getSubtitleByTime = useCallback((time: number) => {
    return subtitles.find(sub => time >= sub.start_time && time <= sub.end_time);
  }, [subtitles]);

  // Auto-update active subtitle based on current time
  const updateActiveSubtitleByTime = useCallback(() => {
    const currentSub = getCurrentSubtitle();
    if (currentSub && currentSub.id !== activeSubtitle) {
      setActiveSubtitle(currentSub.id);
    } else if (!currentSub && activeSubtitle) {
      setActiveSubtitle(null);
    }
  }, [getCurrentSubtitle, activeSubtitle]);

  return {
    subtitles,
    activeSubtitle,
    setActiveSubtitle,
    currentTime,
    setCurrentTime,
    addSubtitle,
    updateSubtitle,
    deleteSubtitle,
    getCurrentSubtitle,
    duplicateSubtitle,
    loadSubtitles,
    clearSubtitles,
    // Navigation functions
    findNextSubtitle,
    findPreviousSubtitle,
    seekToSubtitle,
    getSubtitleByTime,
    updateActiveSubtitleByTime
  };
};