import { Subtitle, ExportOptions } from '../types';

export const exportSubtitles = (subtitles: Subtitle[], options: ExportOptions): string => {
  if (options.format === 'srt') {
    return exportToSRT(subtitles);
  } else {
    return exportToVTT(subtitles, options.includeStyles);
  }
};

const exportToSRT = (subtitles: Subtitle[]): string => {
  return subtitles
    .map((subtitle, index) => {
      const startTime = formatSRTTime(subtitle.start_time);
      const endTime = formatSRTTime(subtitle.end_time);
      const text = subtitle.translatedText || subtitle.text || subtitle.originalText || '';
      
      return `${index + 1}\n${startTime} --> ${endTime}\n${text}\n`;
    })
    .join('\n');
};

const exportToVTT = (subtitles: Subtitle[], includeStyles: boolean): string => {
  let vtt = 'WEBVTT\n\n';
  
  if (includeStyles) {
    vtt += 'STYLE\n::cue {\n  font-family: "Noto Sans Arabic", Arial, sans-serif;\n  direction: rtl;\n}\n\n';
  }
  
  vtt += subtitles
    .map(subtitle => {
      const startTime = formatVTTTime(subtitle.start_time);
      const endTime = formatVTTTime(subtitle.end_time);
      const text = subtitle.translatedText || subtitle.text || subtitle.originalText || '';
      
      let cueSettings = '';
      if (includeStyles) {
        const { styling } = subtitle;
        cueSettings = ` align:${styling.alignment} size:80%`;
      }
      
      return `${startTime} --> ${endTime}${cueSettings}\n${text}\n`;
    })
    .join('\n');
    
  return vtt;
};

const formatSRTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
};

const formatVTTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};