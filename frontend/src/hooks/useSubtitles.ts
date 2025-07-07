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
      startTime,
      endTime,
      originalText: text,
      translatedText: '',
      position: { x: 50, y: 80 },
      styling: { ...defaultStyling }
    };
    
    setSubtitles(prev => [...prev, newSubtitle].sort((a, b) => a.startTime - b.startTime));
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
      currentTime >= sub.startTime && currentTime <= sub.endTime
    );
  }, [subtitles, currentTime]);

  const duplicateSubtitle = useCallback((id: string) => {
    const subtitle = subtitles.find(sub => sub.id === id);
    if (subtitle) {
      const newSubtitle: Subtitle = {
        ...subtitle,
        id: Date.now().toString(),
        startTime: subtitle.endTime,
        endTime: subtitle.endTime + (subtitle.endTime - subtitle.startTime)
      };
      setSubtitles(prev => [...prev, newSubtitle].sort((a, b) => a.startTime - b.startTime));
    }
  }, [subtitles]);

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
    duplicateSubtitle
  };
};