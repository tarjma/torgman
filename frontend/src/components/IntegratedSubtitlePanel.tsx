import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Edit3, Trash2, Copy, Wand2, Clock, Settings, Save, FileText, ChevronUp, ChevronDown, Languages } from 'lucide-react';
import { Subtitle } from '../types';
import { useSubtitleConfig } from '../hooks/useSubtitleConfig';

interface IntegratedSubtitlePanelProps {
  subtitles: Subtitle[];
  activeSubtitle: string | null;
  currentTime: number;
  videoTitle: string;
  projectId?: string;
  translationStatus?: { status: string; message: string; progress?: number } | null;
  onAddSubtitle: (startTime: number, endTime: number) => void;
  onUpdateSubtitle: (id: string, updates: Partial<Subtitle>) => void;
  onDeleteSubtitle: (id: string) => void;
  onSelectSubtitle: (id: string) => void;
  onDuplicateSubtitle: (id: string) => void;
  onTranslateText: (text: string) => Promise<void>;
  onSeekToSubtitle: (startTime: number, subtitleId: string) => void;
  isTranslating: boolean;
  isAutoSaving: boolean;
  onTriggerAutoSave?: () => void;
}

const ARABIC_FONTS = [
  { name: 'Noto Sans Arabic', label: 'نوتو العربية' },
  { name: 'Cairo', label: 'القاهرة' },
  { name: 'Tajawal', label: 'تجوال' },
  { name: 'Arial', label: 'Arial' }
];

const PRESET_COLORS = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00'];

const IntegratedSubtitlePanel: React.FC<IntegratedSubtitlePanelProps> = ({
  subtitles,
  activeSubtitle,
  currentTime,
  videoTitle,
  projectId,
  translationStatus,
  onAddSubtitle,
  onUpdateSubtitle,
  onDeleteSubtitle,
  onDuplicateSubtitle,
  onTranslateText,
  onSeekToSubtitle,
  isTranslating,
  isAutoSaving,
  onTriggerAutoSave
}) => {
  console.log('IntegratedSubtitlePanel received subtitles:', subtitles);
  console.log('Subtitles count:', subtitles.length);
  console.log('Video title:', videoTitle); // Keep for potential future use
  
  const [expandedSubtitle, setExpandedSubtitle] = useState<string | null>(null);
  const [isTranslatingProject, setIsTranslatingProject] = useState(false);
  const [translatingSubtitleId, setTranslatingSubtitleId] = useState<string | null>(null);
  const { translateProject } = useSubtitleConfig();

  // Handle WebSocket translation status updates
  useEffect(() => {
    if (translationStatus) {
      if (translationStatus.status === 'completed' || translationStatus.status === 'completion') {
        setIsTranslatingProject(false);
        console.log('Translation completed:', translationStatus.message);
      } else if (translationStatus.status === 'error') {
        setIsTranslatingProject(false);
        console.error('Translation error:', translationStatus.message);
      } else if (translationStatus.status === 'translating') {
        setIsTranslatingProject(true);
        console.log('Translation in progress:', translationStatus.message);
      }
    }
  }, [translationStatus]);

  // Ref for auto-scrolling to active subtitle
  const activeSubtitleRef = useRef<HTMLDivElement>(null);
  const subtitleListRef = useRef<HTMLDivElement>(null);

  // Simple time formatting function
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll to active subtitle
  useEffect(() => {
    if (activeSubtitle && activeSubtitleRef.current && subtitleListRef.current) {
      const activeElement = activeSubtitleRef.current;
      const container = subtitleListRef.current;
      
      // Calculate if element is in view
      const elementTop = activeElement.offsetTop;
      const elementBottom = elementTop + activeElement.offsetHeight;
      const containerTop = container.scrollTop;
      const containerBottom = containerTop + container.offsetHeight;
      
      // Scroll to element if it's not fully visible
      if (elementTop < containerTop || elementBottom > containerBottom) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [activeSubtitle]);

  const handleAddSubtitle = useCallback(() => {
    const startTime = Math.floor(currentTime);
    const endTime = startTime + 3;
    onAddSubtitle(startTime, endTime);
  }, [currentTime, onAddSubtitle]);

  const handleTextChange = useCallback((id: string, field: 'originalText' | 'translatedText', value: string) => {
    // Update both the specific field and the main text field if it's originalText
    const updates: Partial<Subtitle> = { [field]: value };
    if (field === 'originalText') {
      updates.text = value; // Keep text field in sync with originalText
    }
    onUpdateSubtitle(id, updates);
    
    // Trigger auto-save after text change
    if (onTriggerAutoSave) {
      onTriggerAutoSave();
    }
  }, [onUpdateSubtitle, onTriggerAutoSave]);

  const handleTimeChange = useCallback((id: string, field: 'start_time' | 'end_time', value: string) => {
    const timeValue = parseFloat(value);
    if (!isNaN(timeValue)) {
      onUpdateSubtitle(id, { [field]: timeValue });
      
      // Trigger auto-save after time change
      if (onTriggerAutoSave) {
        onTriggerAutoSave();
      }
    }
  }, [onUpdateSubtitle, onTriggerAutoSave]);

  const handleStyleChange = useCallback((id: string, updates: any) => {
    const subtitle = subtitles.find(s => s.id === id);
    if (subtitle) {
      onUpdateSubtitle(id, { 
        styling: { 
          ...subtitle.styling,
          ...updates 
        } 
      });
      
      // Trigger auto-save after style change
      if (onTriggerAutoSave) {
        onTriggerAutoSave();
      }
    }
  }, [subtitles, onUpdateSubtitle, onTriggerAutoSave]);

  const handleAutoTranslate = useCallback(async (subtitle: Subtitle) => {
    if (subtitle.text || subtitle.originalText) {
      try {
        setTranslatingSubtitleId(subtitle.id);
        // Get the text to translate - use originalText if available, otherwise text
        const textToTranslate = subtitle.originalText || subtitle.text || '';
        await onTranslateText(textToTranslate);
      } catch (error: any) {
        console.error('Auto translation failed:', error);
        
        // More specific error messages
        let errorMessage = 'فشل في الترجمة التلقائية. حاول مرة أخرى.';
        if (error.message?.includes('timeout')) {
          errorMessage = 'انتهت مهلة الترجمة. النص قد يكون طويلاً جداً.';
        } else if (error.message?.includes('service error')) {
          errorMessage = 'خطأ في خدمة الترجمة. حاول مرة أخرى بعد قليل.';
        } else if (error.message?.includes('connection')) {
          errorMessage = 'خطأ في الاتصال. تحقق من الشبكة.';
        }
        
        alert(errorMessage);
      } finally {
        setTranslatingSubtitleId(null);
      }
    }
  }, [onTranslateText]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedSubtitle(expandedSubtitle === id ? null : id);
  }, [expandedSubtitle]);

  // Navigation functions
  const handleNavigateToNext = useCallback(() => {
    const currentIndex = subtitles.findIndex(sub => sub.id === activeSubtitle);
    const nextIndex = currentIndex + 1;
    if (nextIndex < subtitles.length) {
      const nextSubtitle = subtitles[nextIndex];
      onSeekToSubtitle(nextSubtitle.start_time, nextSubtitle.id);
    }
  }, [subtitles, activeSubtitle, onSeekToSubtitle]);

  const handleNavigateToPrevious = useCallback(() => {
    const currentIndex = subtitles.findIndex(sub => sub.id === activeSubtitle);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      const prevSubtitle = subtitles[prevIndex];
      onSeekToSubtitle(prevSubtitle.start_time, prevSubtitle.id);
    }
  }, [subtitles, activeSubtitle, onSeekToSubtitle]);

  const handleTranslateProject = useCallback(async () => {
    if (!projectId) {
      alert('معرف المشروع غير متوفر');
      return;
    }
    
    try {
      setIsTranslatingProject(true);
      
      // Ensure WebSocket connection before starting translation
      try {
        const { webSocketService } = await import('../services/webSocketService');
        
        // Check connection health first
        if (!webSocketService.checkConnectionHealth()) {
          console.log('WebSocket connection is not healthy, reconnecting...');
          await webSocketService.forceReconnect();
        } else {
          await webSocketService.ensureConnection();
        }
        
        console.log('WebSocket connection verified before translation');
      } catch (wsError) {
        console.warn('WebSocket connection issue, attempting to reconnect:', wsError);
        // Continue with translation even if WebSocket has issues
      }
      
      await translateProject(projectId);
      
      // If we reach here, the request was successful
      // Don't show alert here - let the UI indicators show the progress
      // Translation updates will be received via WebSocket
    } catch (error: any) {
      console.error('Translation failed:', error);
      
      // More specific error messages
      let errorMessage = 'فشل في ترجمة المشروع. حاول مرة أخرى.';
      if (error.message?.includes('timeout')) {
        errorMessage = 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'خطأ في الشبكة. تحقق من الاتصال.';
      } else if (error.response?.status === 400 && error.response?.data?.detail?.includes('API key')) {
        errorMessage = 'مفتاح Gemini API غير صحيح أو غير متوفر. يرجى تكوين مفتاح API من الإعدادات.';
      }
      
      alert(errorMessage);
      setIsTranslatingProject(false);
    }
    // Don't set isTranslatingProject to false here - let WebSocket status updates handle it
  }, [projectId, translateProject]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">الترجمات</h2>
              <p className="text-blue-100 text-sm">{subtitles.length} ترجمة نشطة</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Auto-save indicator */}
            {isAutoSaving && (
              <div className="flex items-center gap-2 text-xs bg-white/20 px-3 py-1 rounded-full">
                <Save className="w-3 h-3 animate-pulse" />
                <span>حفظ تلقائي...</span>
              </div>
            )}
            
            {/* Navigation Controls */}
            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
              <button
                onClick={handleNavigateToPrevious}
                disabled={!activeSubtitle || subtitles.findIndex(sub => sub.id === activeSubtitle) === 0}
                className="p-2 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="الترجمة السابقة"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={handleNavigateToNext}
                disabled={!activeSubtitle || subtitles.findIndex(sub => sub.id === activeSubtitle) === subtitles.length - 1}
                className="p-2 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="الترجمة التالية"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleAddSubtitle}
            className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-all font-medium"
          >
            <Plus className="w-4 h-4" />
            إضافة ترجمة جديدة
          </button>
          
          {projectId && (
            <div className="flex flex-col">
              <button
                onClick={handleTranslateProject}
                disabled={isTranslatingProject}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2 transition-all font-medium"
                title="ترجمة جميع النصوص إلى العربية"
              >
                <Languages className={`w-4 h-4 ${isTranslatingProject ? 'animate-spin' : ''}`} />
                {isTranslatingProject ? 
                  (translationStatus?.message || 'جاري الترجمة...') : 
                  'ترجمة المشروع'
                }
              </button>
              
              {/* Translation progress indicator */}
              {isTranslatingProject && (
                <div className="mt-2 bg-white/20 rounded-lg p-2">
                  <div className="flex items-center gap-2 text-xs text-white">
                    <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></div>
                    <span>
                      {translationStatus?.status === 'translating' 
                        ? 'جاري الترجمة...' 
                        : 'معالجة الطلب...'
                      }
                    </span>
                  </div>
                  {translationStatus?.progress !== undefined && (
                    <div className="mt-1 bg-white/30 rounded-full h-1 overflow-hidden">
                      <div 
                        className="bg-emerald-300 h-full transition-all duration-300"
                        style={{ width: `${translationStatus.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subtitles List */}
      <div 
        ref={subtitleListRef}
        className="flex-1 overflow-y-auto bg-gray-50"
      >
        {subtitles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Edit3 className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">لا توجد ترجمات بعد</h3>
            <p className="text-gray-500 mb-6 max-w-xs">ابدأ بإضافة ترجمة جديدة لتظهر على الفيديو</p>
            <button
              onClick={handleAddSubtitle}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              إضافة ترجمة
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {subtitles.map((subtitle) => (
              <div
                key={subtitle.id}
                ref={activeSubtitle === subtitle.id ? activeSubtitleRef : null}
                className={`bg-white rounded-xl shadow-sm border transition-all duration-200 overflow-hidden ${
                  activeSubtitle === subtitle.id
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02] ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {/* Subtitle Header */}
                <div 
                  className="p-4 cursor-pointer relative group"
                  onClick={() => onSeekToSubtitle(subtitle.start_time, subtitle.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs bg-gray-100 px-3 py-1.5 rounded-full font-mono">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span className="font-medium">{formatTime(subtitle.start_time)} - {formatTime(subtitle.end_time)}</span>
                      </div>
                      
                      {/* Current time indicator */}
                      {currentTime >= subtitle.start_time && currentTime <= subtitle.end_time && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="font-medium">مباشر</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAutoTranslate(subtitle);
                        }}
                        disabled={isTranslating || translatingSubtitleId === subtitle.id}
                        className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50"
                        title="ترجمة تلقائية"
                      >
                        <Wand2 className={`w-4 h-4 ${translatingSubtitleId === subtitle.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(subtitle.id);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="تخصيص"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateSubtitle(subtitle.id);
                        }}
                        className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                        title="نسخ"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSubtitle(subtitle.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, 
                          ((currentTime - subtitle.start_time) / (subtitle.end_time - subtitle.start_time)) * 100
                        ))}%` 
                      }}
                    />
                  </div>
                  
                  {/* Text Editing */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">النص الأصلي</label>
                      <textarea
                        value={subtitle.text || subtitle.originalText || ''}
                        onChange={(e) => handleTextChange(subtitle.id, 'originalText', e.target.value)}
                        className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                          isAutoSaving ? 'bg-green-50 border-green-300' : ''
                        }`}
                        rows={2}
                        placeholder="النص الأصلي..."
                        dir="ltr"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">الترجمة العربية</label>
                      <textarea
                        value={subtitle.translatedText}
                        onChange={(e) => handleTextChange(subtitle.id, 'translatedText', e.target.value)}
                        className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                          isAutoSaving ? 'bg-green-50 border-green-300' : ''
                        }`}
                        rows={2}
                        placeholder="الترجمة العربية..."
                        dir="rtl"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>

                {/* Customization Panel */}
                {expandedSubtitle === subtitle.id && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    {/* Time Adjustment */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">ضبط التوقيت</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">البداية</label>
                          <input
                            type="number"
                            step="0.1"
                            value={subtitle.start_time}
                            onChange={(e) => handleTimeChange(subtitle.id, 'start_time', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <span className="text-gray-500 text-sm">إلى</span>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-600 mb-1">النهاية</label>
                          <input
                            type="number"
                            step="0.1"
                            value={subtitle.end_time}
                            onChange={(e) => handleTimeChange(subtitle.id, 'end_time', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Font Settings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">نوع الخط</label>
                        <select
                          value={subtitle.styling.fontFamily}
                          onChange={(e) => handleStyleChange(subtitle.id, { fontFamily: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {ARABIC_FONTS.map(font => (
                            <option key={font.name} value={font.name}>
                              {font.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          حجم الخط ({subtitle.styling.fontSize}px)
                        </label>
                        <input
                          type="range"
                          min="14"
                          max="32"
                          value={subtitle.styling.fontSize}
                          onChange={(e) => handleStyleChange(subtitle.id, { fontSize: parseInt(e.target.value) })}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>

                    {/* Color Settings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">لون النص</label>
                        <div className="flex gap-1">
                          {PRESET_COLORS.slice(0, 3).map(color => (
                            <button
                              key={color}
                              onClick={() => handleStyleChange(subtitle.id, { color })}
                              className={`w-6 h-6 rounded border-2 ${
                                subtitle.styling.color === color ? 'border-gray-800' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">لون الخلفية</label>
                        <div className="flex gap-1">
                          {PRESET_COLORS.slice(0, 3).map(color => (
                            <button
                              key={color}
                              onClick={() => handleStyleChange(subtitle.id, { backgroundColor: color })}
                              className={`w-6 h-6 rounded border-2 ${
                                subtitle.styling.backgroundColor === color ? 'border-gray-800' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Style Options */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStyleChange(subtitle.id, { bold: !subtitle.styling.bold })}
                        className={`px-3 py-1 rounded text-sm font-bold border ${
                          subtitle.styling.bold 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        عريض
                      </button>
                      <button
                        onClick={() => handleStyleChange(subtitle.id, { italic: !subtitle.styling.italic })}
                        className={`px-3 py-1 rounded text-sm italic border ${
                          subtitle.styling.italic 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        مائل
                      </button>
                      <button
                        onClick={() => handleStyleChange(subtitle.id, { outline: !subtitle.styling.outline })}
                        className={`px-3 py-1 rounded text-sm border ${
                          subtitle.styling.outline 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        حدود
                      </button>
                    </div>

                    {/* Preview */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">معاينة</label>
                      <div className="bg-gray-900 rounded p-4 min-h-[40px] flex items-center justify-center">
                        <div 
                          className="text-center"
                          style={{
                            fontFamily: subtitle.styling.fontFamily,
                            fontSize: `${Math.min(subtitle.styling.fontSize, 16)}px`,
                            color: subtitle.styling.color,
                            backgroundColor: subtitle.styling.backgroundColor,
                            fontWeight: subtitle.styling.bold ? 'bold' : 'normal',
                            fontStyle: subtitle.styling.italic ? 'italic' : 'normal',
                            textShadow: subtitle.styling.outline 
                              ? `1px 1px 0 ${subtitle.styling.outlineColor}, -1px -1px 0 ${subtitle.styling.outlineColor}, 1px -1px 0 ${subtitle.styling.outlineColor}, -1px 1px 0 ${subtitle.styling.outlineColor}` 
                              : '1px 1px 2px rgba(0,0,0,0.8)',
                            direction: 'rtl',
                            padding: '4px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          {subtitle.translatedText || subtitle.text || subtitle.originalText || 'معاينة النص'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegratedSubtitlePanel;