import React, { useState, useEffect } from 'react';
import { Settings, Palette, Type, MonitorSpeaker, RotateCcw, ChevronDown, ChevronUp, Save, X, Check } from 'lucide-react';
import { useSubtitleConfig } from '../hooks/useSubtitleConfig';

interface GlobalSubtitleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const ARABIC_FONTS = [
  { name: 'Noto Sans Arabic', label: 'نوتو العربية' },
  { name: 'Cairo', label: 'القاهرة' },
  { name: 'Tajawal', label: 'تجوال' },
  { name: 'Amiri', label: 'أميري' },
  { name: 'Arial', label: 'Arial' }
];

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

// ASS Alignment options (numpad layout)
const ASS_ALIGNMENT_OPTIONS = [
  { value: 7, label: 'أعلى يسار', position: 'top-left' },
  { value: 8, label: 'أعلى وسط', position: 'top-center' },
  { value: 9, label: 'أعلى يمين', position: 'top-right' },
  { value: 4, label: 'وسط يسار', position: 'middle-left' },
  { value: 5, label: 'وسط وسط', position: 'middle-center' },
  { value: 6, label: 'وسط يمين', position: 'middle-right' },
  { value: 1, label: 'أسفل يسار', position: 'bottom-left' },
  { value: 2, label: 'أسفل وسط', position: 'bottom-center' },
  { value: 3, label: 'أسفل يمين', position: 'bottom-right' }
];

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
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    appearance: true,
    position: true,
    advanced: false
  });
  
  // Store initial config to track changes
  const [initialConfig, setInitialConfig] = useState(config);
  
  useEffect(() => {
    if (config && initialConfig) {
      // Check if any changes were made
      const configChanged = JSON.stringify(config) !== JSON.stringify(initialConfig);
      setHasChanges(configChanged);
    }
  }, [config, initialConfig]);
  
  useEffect(() => {
    // Store initial config when modal opens
    if (isOpen && config) {
      setInitialConfig({...config});
    }
  }, [isOpen, config]);

  if (!isOpen || !config) return null;

  const handleUpdateConfig = (field: string, value: any) => {
    updateConfig({ ...config, [field]: value });
  };
  
  const handleSave = () => {
    // Here you would typically persist the changes
    setInitialConfig({...config});
    setHasChanges(false);
    onClose();
  };
  
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('هل أنت متأكد من إلغاء التغييرات؟')) {
        updateConfig(initialConfig);
        onClose();
      }
    } else {
      onClose();
    }
  };
  
  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
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

        <div className="flex flex-1 overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 flex flex-col md:flex-row h-full">
            {/* Settings panel - left side on desktop */}
            <div className="md:w-3/5 p-6 overflow-y-auto">
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
                          <select
                            value={config.fontFamily}
                            onChange={(e) => handleUpdateConfig('fontFamily', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {ARABIC_FONTS.map(font => (
                              <option key={font.name} value={font.name}>
                                {font.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            حجم الخط: {config.fontSize}
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">12</span>
                            <input
                              type="range"
                              min="12"
                              max="48"
                              step="1"
                              value={parseInt(config.fontSize.replace('px', ''))}
                              onChange={(e) => handleUpdateConfig('fontSize', `${e.target.value}px`)}
                              className="flex-1 accent-blue-500"
                            />
                            <span className="text-xs text-gray-500">48</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            سُمك الخط
                          </label>
                          <select
                            value={config.fontWeight}
                            onChange={(e) => handleUpdateConfig('fontWeight', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="normal">عادي</option>
                            <option value="bold">عريض</option>
                            <option value="600">شبه عريض</option>
                            <option value="300">خفيف</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ارتفاع السطر: {config.lineHeight}
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">1.0</span>
                            <input
                              type="range"
                              min="1"
                              max="2"
                              step="0.1"
                              value={parseFloat(config.lineHeight)}
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
                              value={config.color}
                              onChange={(e) => handleUpdateConfig('color', e.target.value)}
                              className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                            />
                            
                            <div className="flex-1 grid grid-cols-6 gap-1.5">
                              {PRESET_COLORS.map((color) => (
                                <button
                                  key={color.color}
                                  onClick={() => handleUpdateConfig('color', color.color)}
                                  className={`w-full aspect-square rounded-md border-2 transition-all ${
                                    config.color === color.color 
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
                              <span className="text-xs text-gray-500">شفافية:</span>
                              <select 
                                value={config.backgroundColor.length === 9 ? config.backgroundColor.slice(7) : '80'}
                                onChange={(e) => {
                                  const baseColor = config.backgroundColor.startsWith('#') 
                                    ? config.backgroundColor.slice(0, 7) 
                                    : config.backgroundColor;
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
                              value={config.backgroundColor.startsWith('#') ? config.backgroundColor.slice(0, 7) : config.backgroundColor}
                              onChange={(e) => {
                                const opacity = config.backgroundColor.length === 9 ? config.backgroundColor.slice(7) : '80';
                                handleUpdateConfig('backgroundColor', `${e.target.value}${opacity}`);
                              }}
                              className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer"
                            />
                            
                            <div className="flex-1 grid grid-cols-6 gap-1.5">
                              {PRESET_COLORS.map((color) => {
                                const isSelected = config.backgroundColor.startsWith(color.color);
                                return (
                                  <button
                                    key={`bg-${color.color}`}
                                    onClick={() => {
                                      const opacity = config.backgroundColor.length === 9 ? config.backgroundColor.slice(7) : '80';
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
                            حافات دائرية: {config.borderRadius}
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">0</span>
                            <input
                              type="range"
                              min="0"
                              max="24"
                              step="2"
                              value={parseInt(config.borderRadius) || 0}
                              onChange={(e) => handleUpdateConfig('borderRadius', `${e.target.value}px`)}
                              className="flex-1 accent-blue-500"
                            />
                            <span className="text-xs text-gray-500">24px</span>
                          </div>
                        </div>
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
                            config.position === pos.value 
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
                          value={config.maxWidth}
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
                            value={config.margin?.bottom || 10}
                            onChange={(e) => handleUpdateConfig('margin', { ...config.margin, bottom: parseFloat(e.target.value) })}
                            className="flex-1 accent-blue-500"
                          />
                          <span className="w-8 text-center">{config.margin?.bottom || 10}</span>
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
                            checked={config.bold || false}
                            onChange={(e) => handleUpdateConfig('bold', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">نص عريض</span>
                        </label>
                        
                        <label className="flex items-center space-x-2 rtl:space-x-reverse">
                          <input
                            type="checkbox"
                            checked={config.italic || false}
                            onChange={(e) => handleUpdateConfig('italic', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">نص مائل</span>
                        </label>
                        
                        <label className="flex items-center space-x-2 rtl:space-x-reverse">
                          <input
                            type="checkbox"
                            checked={config.underline || false}
                            onChange={(e) => handleUpdateConfig('underline', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">نص مُسطر</span>
                        </label>
                        
                        <label className="flex items-center space-x-2 rtl:space-x-reverse">
                          <input
                            type="checkbox"
                            checked={config.strikeOut || false}
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
                              value={config.shadow || 0}
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
                            value={config.outlineColor || '#000000'}
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
                              value={config.secondaryColor || '#0000ff'}
                              onChange={(e) => handleUpdateConfig('secondaryColor', e.target.value)}
                              className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              نوع الحدود
                            </label>
                            <select
                              value={config.borderStyle || 1}
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
                              زاوية الدوران: {config.angle || 0}°
                            </label>
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              value={config.angle || 0}
                              onChange={(e) => handleUpdateConfig('angle', parseFloat(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              مسافة الأحرف: {config.spacing || 0}px
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              value={config.spacing || 0}
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
            <div className="md:w-2/5 bg-gray-100 p-6 md:border-r border-gray-200 overflow-y-auto">
              <div className="sticky top-0">
                <h3 className="font-semibold text-lg mb-4">معاينة مباشرة</h3>
                
                {/* Video-like preview box */}
                <div className="bg-gray-900 rounded-xl overflow-hidden aspect-video mb-6 relative">
                  {/* Simulated video content */}
                  <div className="absolute inset-0 opacity-10 bg-contain bg-center bg-no-repeat" 
                       style={{backgroundImage: 'url(https://via.placeholder.com/800x450)'}}></div>
                  
                  {/* Preview subtitle */}
                  <div className="absolute inset-0 flex items-end justify-center p-4">
                    {config.position === 'top-center' && (
                      <div className="absolute top-4 left-0 right-0 flex justify-center">
                        <div 
                          className="text-center px-4 py-2 max-w-[80%]"
                          style={{
                            fontFamily: config.fontFamily,
                            fontSize: config.fontSize + (config.fontSize?.includes('px') ? '' : 'px'),
                            fontWeight: config.fontWeight,
                            color: config.color,
                            backgroundColor: config.backgroundColor,
                            lineHeight: config.lineHeight,
                            borderRadius: config.borderRadius,
                            padding: config.padding,
                            maxWidth: config.maxWidth,
                            direction: 'rtl',
                            fontStyle: config.italic ? 'italic' : 'normal',
                            textDecoration: `${config.underline ? 'underline' : ''} ${config.strikeOut ? 'line-through' : ''}`.trim() || 'none',
                            transform: `scaleX(${(config.scaleX || 100) / 100}) scaleY(${(config.scaleY || 100) / 100}) rotate(${config.angle || 0}deg)`,
                            letterSpacing: `${config.spacing || 0}px`,
                            textShadow: config.shadow ? `${config.shadow}px ${config.shadow}px ${Math.max(1, config.shadow/2)}px ${config.outlineColor || '#000000'}` : 'none'
                          }}
                        >
                          مرحباً بك في تطبيق الترجمة
                        </div>
                      </div>
                    )}
                    
                    {config.position === 'center' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div 
                          className="text-center px-4 py-2 max-w-[80%]"
                          style={{
                            fontFamily: config.fontFamily,
                            fontSize: config.fontSize + (config.fontSize?.includes('px') ? '' : 'px'),
                            fontWeight: config.fontWeight,
                            color: config.color,
                            backgroundColor: config.backgroundColor,
                            lineHeight: config.lineHeight,
                            borderRadius: config.borderRadius,
                            padding: config.padding,
                            maxWidth: config.maxWidth,
                            direction: 'rtl',
                            fontStyle: config.italic ? 'italic' : 'normal',
                            textDecoration: `${config.underline ? 'underline' : ''} ${config.strikeOut ? 'line-through' : ''}`.trim() || 'none',
                            transform: `scaleX(${(config.scaleX || 100) / 100}) scaleY(${(config.scaleY || 100) / 100}) rotate(${config.angle || 0}deg)`,
                            letterSpacing: `${config.spacing || 0}px`,
                            textShadow: config.shadow ? `${config.shadow}px ${config.shadow}px ${Math.max(1, config.shadow/2)}px ${config.outlineColor || '#000000'}` : 'none'
                          }}
                        >
                          مرحباً بك في تطبيق الترجمة
                        </div>
                      </div>
                    )}
                    
                    {(config.position === 'bottom-center' || !config.position) && (
                      <div className="w-full flex justify-center" style={{marginBottom: `${config.margin?.bottom || 10}px`}}>
                        <div 
                          className="text-center px-4 py-2 max-w-[80%]"
                          style={{
                            fontFamily: config.fontFamily,
                            fontSize: config.fontSize + (config.fontSize?.includes('px') ? '' : 'px'),
                            fontWeight: config.fontWeight,
                            color: config.color,
                            backgroundColor: config.backgroundColor,
                            lineHeight: config.lineHeight,
                            borderRadius: config.borderRadius,
                            padding: config.padding,
                            maxWidth: config.maxWidth,
                            direction: 'rtl',
                            fontStyle: config.italic ? 'italic' : 'normal',
                            textDecoration: `${config.underline ? 'underline' : ''} ${config.strikeOut ? 'line-through' : ''}`.trim() || 'none',
                            transform: `scaleX(${(config.scaleX || 100) / 100}) scaleY(${(config.scaleY || 100) / 100}) rotate(${config.angle || 0}deg)`,
                            letterSpacing: `${config.spacing || 0}px`,
                            textShadow: config.shadow ? `${config.shadow}px ${config.shadow}px ${Math.max(1, config.shadow/2)}px ${config.outlineColor || '#000000'}` : 'none'
                          }}
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
                    style={{
                      fontFamily: config.fontFamily,
                      fontSize: config.fontSize + (config.fontSize?.includes('px') ? '' : 'px'),
                      fontWeight: config.fontWeight,
                      color: config.color,
                      backgroundColor: config.backgroundColor,
                      lineHeight: config.lineHeight,
                      borderRadius: config.borderRadius,
                      padding: config.padding,
                      maxWidth: "100%",
                      direction: 'rtl',
                      fontStyle: config.italic ? 'italic' : 'normal',
                      textDecoration: `${config.underline ? 'underline' : ''} ${config.strikeOut ? 'line-through' : ''}`.trim() || 'none',
                      letterSpacing: `${config.spacing || 0}px`,
                      textShadow: config.shadow ? `${config.shadow}px ${config.shadow}px ${Math.max(1, config.shadow/2)}px ${config.outlineColor || '#000000'}` : 'none'
                    }}
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
                hasChanges 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-400 text-white cursor-not-allowed'
              } transition-colors`}
              disabled={!hasChanges}
            >
              <Save size={16} />
              حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSubtitleSettings;
