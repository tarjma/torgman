import React, { useState, useCallback } from 'react';
import { Plus, Edit3, Trash2, Copy, Wand2, Clock, Download, Settings, Save, FileText, Play } from 'lucide-react';
import { Subtitle, ExportOptions } from '../types';
import { formatTime, exportSubtitles, downloadFile } from '../utils/exportUtils';

interface IntegratedSubtitlePanelProps {
  subtitles: Subtitle[];
  activeSubtitle: string | null;
  currentTime: number;
  videoTitle: string;
  onAddSubtitle: (startTime: number, endTime: number) => void;
  onUpdateSubtitle: (id: string, updates: Partial<Subtitle>) => void;
  onDeleteSubtitle: (id: string) => void;
  onSelectSubtitle: (id: string) => void;
  onDuplicateSubtitle: (id: string) => void;
  onTranslateText: (text: string) => Promise<void>;
  onSeekToSubtitle: (startTime: number, subtitleId: string) => void;
  isTranslating: boolean;
  isAutoSaving: boolean;
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
  onAddSubtitle,
  onUpdateSubtitle,
  onDeleteSubtitle,
  onSelectSubtitle,
  onDuplicateSubtitle,
  onTranslateText,
  onSeekToSubtitle,
  isTranslating,
  isAutoSaving
}) => {
  const [expandedSubtitle, setExpandedSubtitle] = useState<string | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'srt',
    includeStyles: false,
    encoding: 'utf-8'
  });

  const handleAddSubtitle = useCallback(() => {
    const startTime = Math.floor(currentTime);
    const endTime = startTime + 3;
    onAddSubtitle(startTime, endTime);
  }, [currentTime, onAddSubtitle]);

  const handleTextChange = useCallback((id: string, field: 'originalText' | 'translatedText', value: string) => {
    onUpdateSubtitle(id, { [field]: value });
  }, [onUpdateSubtitle]);

  const handleTimeChange = useCallback((id: string, field: 'startTime' | 'endTime', value: string) => {
    const timeValue = parseFloat(value);
    if (!isNaN(timeValue)) {
      onUpdateSubtitle(id, { [field]: timeValue });
    }
  }, [onUpdateSubtitle]);

  const handleStyleChange = useCallback((id: string, updates: any) => {
    const subtitle = subtitles.find(s => s.id === id);
    if (subtitle) {
      onUpdateSubtitle(id, { 
        styling: { 
          ...subtitle.styling,
          ...updates 
        } 
      });
    }
  }, [subtitles, onUpdateSubtitle]);

  const handleAutoTranslate = useCallback(async (subtitle: Subtitle) => {
    if (subtitle.originalText) {
      await onTranslateText(subtitle.originalText);
    }
  }, [onTranslateText]);

  const handleExport = useCallback(() => {
    if (subtitles.length === 0) {
      alert('لا توجد ترجمات للتصدير');
      return;
    }

    const content = exportSubtitles(subtitles, exportOptions);
    const filename = `${videoTitle}_arabic.${exportOptions.format}`;
    const mimeType = exportOptions.format === 'srt' ? 'text/srt' : 'text/vtt';
    
    downloadFile(content, filename, mimeType);
    setShowExportOptions(false);
  }, [subtitles, exportOptions, videoTitle]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedSubtitle(expandedSubtitle === id ? null : id);
  }, [expandedSubtitle]);

  return (
    <div className="h-full flex flex-col bg-white rounded-lg overflow-hidden border">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h2 className="text-lg font-bold">الترجمات</h2>
            <span className="text-blue-200 text-sm">({subtitles.length})</span>
          </div>
          
          <div className="flex items-center gap-2">
            {isAutoSaving && (
              <div className="flex items-center gap-1 text-xs bg-blue-500 px-2 py-1 rounded">
                <Save className="w-3 h-3" />
                حفظ تلقائي
              </div>
            )}
            
            <div className="relative">
              <button
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="bg-blue-500 hover:bg-blue-400 px-3 py-1 rounded text-sm flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                تصدير
              </button>
              
              {showExportOptions && (
                <div className="absolute top-full left-0 mt-2 bg-white text-gray-900 rounded-lg shadow-lg border p-4 min-w-[250px] z-50">
                  <h4 className="font-medium mb-3">إعدادات التصدير</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">صيغة الملف</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExportOptions(prev => ({ ...prev, format: 'srt' }))}
                          className={`flex-1 px-3 py-2 rounded text-sm border ${
                            exportOptions.format === 'srt'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300'
                          }`}
                        >
                          SRT
                        </button>
                        <button
                          onClick={() => setExportOptions(prev => ({ ...prev, format: 'vtt' }))}
                          className={`flex-1 px-3 py-2 rounded text-sm border ${
                            exportOptions.format === 'vtt'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300'
                          }`}
                        >
                          WebVTT
                        </button>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleExport}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      تحميل الملف
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleAddSubtitle}
          className="w-full bg-blue-500 hover:bg-blue-400 px-4 py-2 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          إضافة ترجمة جديدة
        </button>
      </div>

      {/* Subtitles List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {subtitles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Edit3 className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-700 mb-2">لا توجد ترجمات</h3>
            <p className="text-sm text-gray-500 mb-4">ابدأ بإضافة ترجمة جديدة</p>
            <button
              onClick={handleAddSubtitle}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              إضافة ترجمة
            </button>
          </div>
        ) : (
          subtitles.map((subtitle) => (
            <div
              key={subtitle.id}
              className={`border rounded-lg overflow-hidden transition-all ${
                activeSubtitle === subtitle.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Subtitle Header */}
              <div 
                className="p-3 cursor-pointer"
                onClick={() => onSeekToSubtitle(subtitle.startTime, subtitle.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <button className="flex items-center gap-2 text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                    <Clock className="w-3 h-3" />
                    {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAutoTranslate(subtitle);
                      }}
                      disabled={isTranslating}
                      className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors disabled:opacity-50"
                      title="ترجمة تلقائية"
                    >
                      <Wand2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(subtitle.id);
                      }}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      title="تخصيص"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateSubtitle(subtitle.id);
                      }}
                      className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                      title="نسخ"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSubtitle(subtitle.id);
                      }}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Text Editing */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">النص الأصلي</label>
                    <textarea
                      value={subtitle.originalText}
                      onChange={(e) => handleTextChange(subtitle.id, 'originalText', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      placeholder="النص الأصلي..."
                      dir="ltr"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">الترجمة العربية</label>
                    <textarea
                      value={subtitle.translatedText}
                      onChange={(e) => handleTextChange(subtitle.id, 'translatedText', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <div className="border-t bg-gray-50 p-3 space-y-3">
                  {/* Time Adjustment */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ضبط التوقيت</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">البداية</label>
                        <input
                          type="number"
                          step="0.1"
                          value={subtitle.startTime}
                          onChange={(e) => handleTimeChange(subtitle.id, 'startTime', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <span className="text-gray-500 text-sm">إلى</span>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">النهاية</label>
                        <input
                          type="number"
                          step="0.1"
                          value={subtitle.endTime}
                          onChange={(e) => handleTimeChange(subtitle.id, 'endTime', e.target.value)}
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
                        {subtitle.translatedText || subtitle.originalText || 'معاينة النص'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default IntegratedSubtitlePanel;