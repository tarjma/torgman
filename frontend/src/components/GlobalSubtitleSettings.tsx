import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Palette, MonitorSpeaker, RotateCcw, ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { useSubtitleConfig } from '../hooks/useSubtitleConfig';
import FontSelector from './FontSelector';
import FontWeightSelector from './FontWeightSelector';
import { SubtitleConfig } from '../types/subtitleConfig';

interface GlobalSubtitleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// Dynamic fonts are loaded via FontSelector/FontWeightSelector. Remove hardcoded list.

const PRESET_COLORS = [
  { color: '#ffffff', name: 'أبيض' },
  { color: '#000000', name: 'أسود' },
  { color: '#ffff00', name: 'أصفر' },
  { color: '#ff0000', name: 'أحمر' },
  { color: '#00ff00', name: 'أخضر' },
  { color: '#0080ff', name: 'أزرق' },
];

const POSITION_OPTIONS = [
  { value: 'bottom-center', label: 'الأسفل', icon: '⬇️', alignment: 2 },
  { value: 'center', label: 'الوسط', icon: '⬌', alignment: 5 },
  { value: 'top-center', label: 'الأعلى', icon: '⬆️', alignment: 8 }
];

// Map human-friendly weights to CSS-recognized values for live preview
const weightToCss = (w?: string): number | string => {
  const map: Record<string, number | string> = {
    Thin: 100,
    ExtraLight: 200,
    Light: 300,
    Regular: 400,
    Medium: 500,
    SemiBold: 600,
    Bold: 700,
    ExtraBold: 800,
    Black: 900,
    normal: 400,
    bold: 700,
    '300': 300,
    '600': 600,
  };
  if (!w) return 400;
  return map[w] ?? w;
};

const BORDER_STYLE_OPTIONS = [
  { value: 1, label: 'حدود + ظل', description: 'Outline + Shadow' },
  { value: 3, label: 'صندوق مُصمت', description: 'Opaque Box' }
];

const GlobalSubtitleSettings: React.FC<GlobalSubtitleSettingsProps> = ({ 
  isOpen, 
  onClose, 
  className = '' 
}) => {
  const { config, updateConfig, resetConfig } = useSubtitleConfig();
  const [localConfig, setLocalConfig] = useState<SubtitleConfig | null>(config);
  const [isSaving, setIsSaving] = useState(false);
  // Better mobile UX: toggle between settings/preview on small screens
  const [mobileTab, setMobileTab] = useState<'settings' | 'preview'>('settings');
  const [expandedSections, setExpandedSections] = useState({
    appearance: true,
    position: true,
    advanced: false
  });
  
  // Store initial config to track changes
  const [initialConfig, setInitialConfig] = useState<SubtitleConfig | null>(config);
  
  useEffect(() => {
    // Store initial config when modal opens and sync local config
    if (isOpen && config) {
      setInitialConfig({...config});
      setLocalConfig({...config});
    }
  }, [isOpen, config]);

  const hasChanges = useMemo(() => {
    if (!localConfig || !initialConfig) {
      return false;
    }
    return JSON.stringify(localConfig) !== JSON.stringify(initialConfig);
  }, [localConfig, initialConfig]);

  const handleUpdateConfig = <K extends keyof SubtitleConfig>(field: K, value: SubtitleConfig[K]) => {
    if (!localConfig) {
      return;
    }
    setLocalConfig({ ...localConfig, [field]: value });
  };
  
  const handleSave = () => {
    if (!localConfig) {
      return;
    }
    setIsSaving(true);
    updateConfig(localConfig)
      .then(() => {
        setInitialConfig({ ...localConfig });
        onClose();
      })
      .catch((error) => {
        console.error('Failed to save subtitle configuration:', error);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };
  
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('هل أنت متأكد من إلغاء التغييرات؟')) {
        if (initialConfig) {
          setLocalConfig({...initialConfig});
        }
        onClose();
      }
    } else {
      onClose();
    }
  };
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  // Memoize preview text styling so the live preview stays performant and consistent
  const sharedPreviewStyle = useMemo<React.CSSProperties>(() => {
    if (!localConfig) {
      return {};
    }

    const resolvedFontSize = localConfig.fontSize && localConfig.fontSize.includes('px')
      ? localConfig.fontSize
      : `${localConfig.fontSize || 28}px`;

    const resolvedTextDecoration = [
      localConfig.underline ? 'underline' : '',
      localConfig.strikeOut ? 'line-through' : ''
    ].filter(Boolean).join(' ') || 'none';

    const scaleX = (localConfig.scaleX ?? 100) / 100;
    const scaleY = (localConfig.scaleY ?? 100) / 100;
    const rotation = localConfig.angle ?? 0;
    const shadowStrength = localConfig.shadow ?? 0;

    return {
      fontFamily: localConfig.fontFamily,
      fontSize: resolvedFontSize,
      fontWeight: weightToCss(localConfig.fontWeight),
      color: localConfig.color,
      backgroundColor: localConfig.backgroundColor,
      lineHeight: localConfig.lineHeight,
      borderRadius: localConfig.borderRadius,
      padding: localConfig.borderStyle === 3 ? `${localConfig.outline ?? 8}px` : localConfig.padding,
      maxWidth: localConfig.maxWidth,
      direction: 'rtl',
      fontStyle: localConfig.italic ? 'italic' : 'normal',
      textDecoration: resolvedTextDecoration,
      transform: `scaleX(${scaleX}) scaleY(${scaleY}) rotate(${rotation}deg)`,
      letterSpacing: `${localConfig.spacing ?? 0}px`,
      textShadow: shadowStrength
        ? `${shadowStrength}px ${shadowStrength}px ${Math.max(1, shadowStrength / 2)}px ${localConfig.outlineColor || '#000000'}`
        : 'none'
    };
  }, [localConfig]);

  if (!isOpen || !localConfig) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 sm:p-6 ${className}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6" />
              <h2 className="text-xl font-bold">إعدادات الترجمات العامة</h2>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content area should be the only scrollable region inside the modal */}
  <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row h-full">
            {/* Mobile tabs to switch between panels */}
            <div className="md:hidden border-b bg-white sticky top-0 z-10">
              <div className="p-2 flex gap-2">
                <button
                  onClick={() => setMobileTab('settings')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                    mobileTab === 'settings' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  الإعدادات
                </button>
                <button
                  onClick={() => setMobileTab('preview')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                    mobileTab === 'preview' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  المعاينة
                </button>
              </div>
            </div>
            {/* Settings panel - left side on desktop */}
            <div className={`md:w-3/5 p-6 overflow-y-auto min-h-0 ${mobileTab === 'settings' ? '' : 'hidden md:block'}`}> 
              {/* Appearance Section */}
              <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('appearance')}
                  className="w-full flex items-center justify-between bg-gray-50 p-4 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-800">مظهر الترجمة</h3>
                  </div>
                  {expandedSections.appearance ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                
                {expandedSections.appearance && (
                  <div className="p-5 space-y-6">
                    {/* Font Settings */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">الخط</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            نوع الخط
                          </label>
                          <FontSelector
                            value={localConfig.fontFamily}
                            onChange={(font) => handleUpdateConfig('fontFamily', font)}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            حجم الخط: {localConfig.fontSize}
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">12</span>
                            <input
                              type="range"
                              min="12"
                              max="48"
                              step="1"
                              value={parseInt(localConfig.fontSize?.replace('px', '') || '28')}
                              onChange={(e) => handleUpdateConfig('fontSize', `${e.target.value}px`)}
                              className="flex-1 accent-blue-500"
                            />
                            <span className="text-xs text-gray-500">48</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            وزن الخط
                          </label>
                          <FontWeightSelector
                            fontFamily={localConfig.fontFamily}
                            value={localConfig.fontWeight}
                            onChange={(w) => handleUpdateConfig('fontWeight', w)}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ارتفاع السطر: {localConfig.lineHeight}
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">1.0</span>
                            <input
                              type="range"
                              min="1"
                              max="2"
                              step="0.1"
                              value={parseFloat(localConfig.lineHeight || '1.4')}
                              onChange={(e) => handleUpdateConfig('lineHeight', e.target.value)}
                              className="flex-1 accent-blue-500"
                            />
                            <span className="text-xs text-gray-500">2.0</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Colors */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">الألوان</h4>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            لون النص
                          </label>
                          <div className="flex gap-3 items-center">
                            <input
                              type="color"
                              value={localConfig.color}
                              onChange={(e) => handleUpdateConfig('color', e.target.value)}
                              className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                            />
                            
                            <div className="flex-1 grid grid-cols-6 gap-1.5">
                              {PRESET_COLORS.map((color) => (
                                <button
                                  key={color.color}
                                  onClick={() => handleUpdateConfig('color', color.color)}
                                  className={`w-full aspect-square rounded-md border-2 transition-all ${
                                    localConfig.color === color.color 
                                      ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' 
                                      : 'border-gray-200 hover:scale-105'
                                  }`}
                                  style={{ backgroundColor: color.color }}
                                  title={color.name}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              لون الخلفية
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">مقدار ظلامية الخلفية:</span>
                              <select
                                value={localConfig.backgroundColor.length === 9 ? localConfig.backgroundColor.slice(7) : '80'}
                                onChange={(e) => {
                                  const baseColor = localConfig.backgroundColor.startsWith('#') 
                                    ? localConfig.backgroundColor.slice(0, 7) 
                                    : localConfig.backgroundColor;
                                  handleUpdateConfig('backgroundColor', `${baseColor}${e.target.value}`);
                                }}
                                className="text-xs border border-gray-200 rounded p-0.5"
                              >
                                <option value="00">0%</option>
                                <option value="33">20%</option>
                                <option value="80">50%</option>
                                <option value="CC">80%</option>
                                <option value="FF">100%</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="flex gap-3 items-center">
                            <input
                              type="color"
                              value={localConfig.backgroundColor.startsWith('#') ? localConfig.backgroundColor.slice(0, 7) : localConfig.backgroundColor}
                              onChange={(e) => {
                                const opacity = localConfig.backgroundColor.length === 9 ? localConfig.backgroundColor.slice(7) : '80';
                                handleUpdateConfig('backgroundColor', `${e.target.value}${opacity}`);
                              }}
                              className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                            />
                            
                            <div className="flex-1 grid grid-cols-6 gap-1.5">
                              {PRESET_COLORS.map((color) => {
                                const isSelected = localConfig.backgroundColor.startsWith(color.color);
                                return (
                                  <button
                                    key={`bg-${color.color}`}
                                    onClick={() => {
                                      const opacity = localConfig.backgroundColor.length === 9 ? localConfig.backgroundColor.slice(7) : '80';
                                      handleUpdateConfig('backgroundColor', `${color.color}${opacity}`);
                                    }}
                                    className={`w-full aspect-square rounded-md border-2 transition-all ${
                                      isSelected 
                                        ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' 
                                        : 'border-gray-200 hover:scale-105'
                                    }`}
                                    style={{ 
                                      backgroundColor: color.color,
                                      opacity: 0.8
                                    }}
                                    title={color.name}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            حافات دائرية: {localConfig.borderRadius}
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">0</span>
                            <input
                              type="range"
                              min="0"
                              max="24"
                              step="2"
                              value={parseInt(localConfig.borderRadius || '0') || 0}
                              onChange={(e) => handleUpdateConfig('borderRadius', `${e.target.value}px`)}
                              className="flex-1 accent-blue-500"
                            />
                            <span className="text-xs text-gray-500">24px</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Background padding (ASS Outline as padding for opaque box) */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">حشوة الخلفية (يمين/يسار)</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          مقدار الحشوة: {localConfig.outline ?? 8}px
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">0</span>
                          <input
                            type="range"
                            min="0"
                            max="24"
                            step="1"
                            value={localConfig.outline ?? 8}
                            onChange={(e) => handleUpdateConfig('outline', parseInt(e.target.value))}
                            className="flex-1 accent-blue-500"
                          />
                          <span className="text-xs text-gray-500">24</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          عند استخدام صندوق الخلفية، تُعتبر الحواف (Outline) في ASS بمثابة حشوة حول النص.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Position Section */}
              <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('position')}
                  className="w-full flex items-center justify-between bg-gray-50 p-4 text-left"
                >
                  <div className="flex items-center gap-2">
                    <MonitorSpeaker className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-800">موضع الترجمة</h3>
                  </div>
                  {expandedSections.position ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                
                {expandedSections.position && (
                  <div className="p-5 space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      {POSITION_OPTIONS.map(pos => (
                        <button
                          key={pos.value}
                          onClick={() => handleUpdateConfig('position', pos.value)}
                          className={`p-4 rounded-lg border-2 transition-all text-center ${
                            localConfig.position === pos.value 
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="text-2xl mb-2">{pos.icon}</div>
                          <div className="text-sm font-medium">{pos.label}</div>
                        </button>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          العرض الأقصى
                        </label>
                        <input
                          type="text"
                          value={localConfig.maxWidth}
                          onChange={(e) => handleUpdateConfig('maxWidth', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="80%"
                        />
                        <p className="text-xs text-gray-500 mt-1">مثل: 80% أو 500px</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          المسافة من الأسفل
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={localConfig.margin?.bottom || 10}
                            onChange={(e) => handleUpdateConfig('margin', { ...localConfig.margin, bottom: parseFloat(e.target.value) })}
                            className="flex-1 accent-blue-500"
                          />
                          <span className="w-8 text-center">{localConfig.margin?.bottom || 10}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Advanced Section */}
              <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <button 
                  onClick={() => toggleSection('advanced')}
                  className="w-full flex items-center justify-between bg-gray-50 p-4 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-800">إعدادات متقدمة</h3>
                  </div>
                  {expandedSections.advanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                
                {expandedSections.advanced && (
                  <div className="p-5 space-y-6">
                    <div className="space-y-4 mb-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">تأثيرات النص</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="flex items-center space-x-2 rtl:space-x-reverse">
                          <input
                            type="checkbox"
                            checked={localConfig.bold || false}
                            onChange={(e) => handleUpdateConfig('bold', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">نص عريض</span>
                        </label>
                        
                        <label className="flex items-center space-x-2 rtl:space-x-reverse">
                          <input
                            type="checkbox"
                            checked={localConfig.italic || false}
                            onChange={(e) => handleUpdateConfig('italic', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">نص مائل</span>
                        </label>
                        
                        <label className="flex items-center space-x-2 rtl:space-x-reverse">
                          <input
                            type="checkbox"
                            checked={localConfig.underline || false}
                            onChange={(e) => handleUpdateConfig('underline', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">نص مُسطر</span>
                        </label>
                        
                        <label className="flex items-center space-x-2 rtl:space-x-reverse">
                          <input
                            type="checkbox"
                            checked={localConfig.strikeOut || false}
                            onChange={(e) => handleUpdateConfig('strikeOut', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">نص مشطوب</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4 mb-4">
                      <h4 className="font-medium text-gray-700 border-b pb-2">الحدود والظل</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            قوة الظل
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">بدون</span>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="1"
                              value={localConfig.shadow || 0}
                              onChange={(e) => {
                                handleUpdateConfig('shadow', parseInt(e.target.value));
                              }}
                              className="flex-1 accent-blue-500"
                            />
                            <span className="text-xs text-gray-500">قوي</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            لون الظل والحدود
                          </label>
                          <input
                            type="color"
                            value={localConfig.outlineColor || '#000000'}
                            onChange={(e) => handleUpdateConfig('outlineColor', e.target.value)}
                            className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-gray-700 hover:text-blue-600 transition-colors mb-2">
                        إعدادات ASS المتقدمة
                      </summary>
                      <div className="pt-2 pb-4 border-t space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              لون ثانوي (كاراوكي)
                            </label>
                            <input
                              type="color"
                              value={localConfig.secondaryColor || '#0000ff'}
                              onChange={(e) => handleUpdateConfig('secondaryColor', e.target.value)}
                              className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              نوع الحدود
                            </label>
                            <select
                              value={localConfig.borderStyle || 1}
                              onChange={(e) => handleUpdateConfig('borderStyle', parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              {BORDER_STYLE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              زاوية الدوران: {localConfig.angle || 0}°
                            </label>
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              value={localConfig.angle || 0}
                              onChange={(e) => handleUpdateConfig('angle', parseFloat(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              مسافة الأحرف: {localConfig.spacing || 0}px
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              value={localConfig.spacing || 0}
                              onChange={(e) => handleUpdateConfig('spacing', parseInt(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
            
            {/* Preview panel - right side on desktop */}
            <div className={`md:w-2/5 bg-gray-100 p-6 md:border-r border-gray-200 overflow-y-auto min-h-0 ${mobileTab === 'preview' ? '' : 'hidden md:block'}`}> 
              <div className="sticky top-0">
                <h3 className="font-semibold text-lg mb-4">معاينة مباشرة</h3>
                
                {/* Video-like preview box */}
                <div className="bg-gray-900 rounded-xl overflow-hidden aspect-video mb-6 relative">
                  {/* Simulated video content */}
                  <div className="absolute inset-0 opacity-10 bg-contain bg-center bg-no-repeat" 
                       style={{backgroundImage: 'url(https://via.placeholder.com/800x450)'}}></div>
                  
                  {/* Preview subtitle */}
                  <div className="absolute inset-0 flex items-end justify-center p-4">
                    {localConfig.position === 'top-center' && (
                      <div className="absolute top-4 left-0 right-0 flex justify-center">
                        <div 
                          className="text-center px-4 py-2 max-w-[80%]"
                          style={sharedPreviewStyle}
                        >
                          مرحباً بك في تطبيق الترجمة
                        </div>
                      </div>
                    )}
                    
                    {localConfig.position === 'center' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div 
                          className="text-center px-4 py-2 max-w-[80%]"
                          style={sharedPreviewStyle}
                        >
                          مرحباً بك في تطبيق الترجمة
                        </div>
                      </div>
                    )}
                    
                    {(localConfig.position === 'bottom-center' || !localConfig.position) && (
                      <div className="w-full flex justify-center" style={{marginBottom: `${localConfig.margin?.bottom || 10}px`}}>
                        <div 
                          className="text-center px-4 py-2 max-w-[80%]"
                          style={sharedPreviewStyle}
                        >
                          مرحباً بك في تطبيق الترجمة
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">نص عينة آخر</h4>
                  <div 
                    className="bg-gray-800 rounded-lg p-4 text-center"
                    style={{ ...sharedPreviewStyle, maxWidth: '100%' }}
                  >
                    هذا مثال على ترجمة طويلة على سطرين
                    <br/>
                    يمكن رؤية التنسيق بشكل واضح هنا
                  </div>
                </div>
                
                {hasChanges && (
                  <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    تم تغيير الإعدادات. اضغط على "حفظ" لتطبيق التغييرات.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-4 flex justify-between items-center">
          <button
            onClick={() => resetConfig()}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors flex items-center gap-1"
          >
            <RotateCcw size={16} />
            إعادة تعيين
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <X size={16} />
              إلغاء
            </button>
            <button
              onClick={handleSave}
              className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                hasChanges && !isSaving
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-400 text-white cursor-not-allowed'
              } transition-colors`}
              disabled={!hasChanges || isSaving}
            >
              <Save size={16} />
              {isSaving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSubtitleSettings;
