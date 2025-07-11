import React, { useState } from 'react';
import { Settings, Palette, Type, MonitorSpeaker } from 'lucide-react';
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
  { value: 'bottom-center', label: 'الأسفل', icon: '⬇️' },
  { value: 'center', label: 'الوسط', icon: '⬌' },
  { value: 'top-center', label: 'الأعلى', icon: '⬆️' }
];

const GlobalSubtitleSettings: React.FC<GlobalSubtitleSettingsProps> = ({ 
  isOpen, 
  onClose, 
  className = '' 
}) => {
  const { config, updateConfig, resetConfig } = useSubtitleConfig();
  const [activeTab, setActiveTab] = useState<'style' | 'position' | 'advanced'>('style');

  if (!isOpen) return null;

  const handleUpdateConfig = (field: string, value: any) => {
    updateConfig({ ...config, [field]: value });
  };

  const tabs = [
    { id: 'style', label: 'التصميم', icon: Palette },
    { id: 'position', label: 'الموضع', icon: MonitorSpeaker },
    { id: 'advanced', label: 'متقدم', icon: Settings }
  ];

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6" />
              <h2 className="text-xl font-bold">إعدادات الترجمات العامة</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === tab.id 
                      ? 'bg-white text-blue-600 shadow-lg' 
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'style' && (
            <div className="space-y-6">
              {/* Font Settings */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Type className="w-5 h-5" />
                  إعدادات الخط
                </h3>
                
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
                    <input
                      type="range"
                      min="12"
                      max="48"
                      value={parseInt(config.fontSize.replace('px', ''))}
                      onChange={(e) => handleUpdateConfig('fontSize', `${e.target.value}px`)}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>صغير</span>
                      <span>كبير</span>
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
                    <input
                      type="range"
                      min="1"
                      max="2"
                      step="0.1"
                      value={parseFloat(config.lineHeight)}
                      onChange={(e) => handleUpdateConfig('lineHeight', e.target.value)}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Color Settings */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  الألوان والخلفية
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      لون النص
                    </label>
                    <div className="flex gap-2 mb-2">
                      {PRESET_COLORS.map(preset => (
                        <button
                          key={preset.color}
                          onClick={() => handleUpdateConfig('color', preset.color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                            config.color === preset.color ? 'border-blue-500 scale-110' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                      <input
                        type="color"
                        value={config.color}
                        onChange={(e) => handleUpdateConfig('color', e.target.value)}
                        className="w-8 h-8 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      لون الخلفية
                    </label>
                    <input
                      type="text"
                      value={config.backgroundColor}
                      onChange={(e) => handleUpdateConfig('backgroundColor', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="rgba(0, 0, 0, 0.8)"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      استخدم rgba للشفافية، مثل: rgba(0, 0, 0, 0.8)
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ظل النص
                    </label>
                    <input
                      type="text"
                      value={config.textShadow}
                      onChange={(e) => handleUpdateConfig('textShadow', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="2px 2px 4px rgba(0,0,0,0.8)"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'position' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4">موضع الترجمات</h3>
                
                <div className="grid grid-cols-3 gap-3 mb-4">
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
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      المسافة من الأسفل
                    </label>
                    <input
                      type="text"
                      value={config.marginBottom}
                      onChange={(e) => handleUpdateConfig('marginBottom', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="60px"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-lg font-semibold mb-4">إعدادات متقدمة</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        إظهار الترجمة مع النص الأصلي
                      </label>
                      <p className="text-xs text-gray-500">عرض النص المترجم تحت النص الأصلي</p>
                    </div>
                    <button
                      onClick={() => handleUpdateConfig('showTranslation', !config.showTranslation)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.showTranslation ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.showTranslation ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {config.showTranslation && (
                    <div className="grid grid-cols-2 gap-4 ml-4 p-4 bg-white rounded-lg border">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          لون الترجمة
                        </label>
                        <input
                          type="color"
                          value={config.translationColor}
                          onChange={(e) => handleUpdateConfig('translationColor', e.target.value)}
                          className="w-full h-10 border border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          حجم خط الترجمة
                        </label>
                        <input
                          type="text"
                          value={config.translationFontSize}
                          onChange={(e) => handleUpdateConfig('translationFontSize', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="14px"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        نصف قطر الحواف
                      </label>
                      <input
                        type="text"
                        value={config.borderRadius}
                        onChange={(e) => handleUpdateConfig('borderRadius', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="8px"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الحشو الداخلي
                      </label>
                      <input
                        type="text"
                        value={config.padding}
                        onChange={(e) => handleUpdateConfig('padding', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="8px 12px"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="bg-gray-900 rounded-xl p-6 relative overflow-hidden">
            <h3 className="text-white text-sm font-medium mb-4">معاينة</h3>
            <div className="relative h-32 flex items-center justify-center">
              <div 
                className="text-center max-w-[80%] rounded-lg"
                style={{
                  fontFamily: config.fontFamily,
                  fontSize: config.fontSize,
                  fontWeight: config.fontWeight,
                  color: config.color,
                  backgroundColor: config.backgroundColor,
                  lineHeight: config.lineHeight,
                  textShadow: config.textShadow,
                  borderRadius: config.borderRadius,
                  padding: config.padding,
                  maxWidth: config.maxWidth,
                  direction: 'rtl'
                }}
              >
                مرحباً بك في تطبيق الترجمة
                {config.showTranslation && (
                  <div 
                    style={{
                      color: config.translationColor,
                      fontSize: config.translationFontSize,
                      marginTop: '4px'
                    }}
                  >
                    Welcome to the translation app
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
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            إعادة تعيين
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSubtitleSettings;
