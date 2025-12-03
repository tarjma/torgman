import React from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useSubtitleConfig } from '../hooks/useSubtitleConfig';
import { SubtitleConfig } from '../types/subtitleConfig';
import FontSelector from './FontSelector';
import FontWeightSelector from './FontWeightSelector';

// Preset colors for quick selection
const TEXT_COLORS = [
  { color: '#ffffff', name: 'أبيض' },
  { color: '#ffff00', name: 'أصفر' },
  { color: '#00ffff', name: 'سماوي' },
  { color: '#ffd700', name: 'ذهبي' },
];

const BG_COLORS = [
  { color: '#000000', name: 'أسود' },
  { color: '#1a1a2e', name: 'كحلي' },
  { color: '#0f3460', name: 'أزرق داكن' },
];

const SubtitleStylePanel: React.FC = () => {
  const { config, updateConfig, resetConfig, isSaving } = useSubtitleConfig();

  if (!config) {
    return (
      <div className="p-4 text-center text-gray-500">
        جاري تحميل الإعدادات...
      </div>
    );
  }

  // Helper to update a single field
  const updateField = <K extends keyof SubtitleConfig>(key: K, value: SubtitleConfig[K]) => {
    updateConfig({ ...config, [key]: value });
  };

  // Parse current values
  const currentFontSize = parseInt(config.fontSize?.replace('px', '') || '28');
  const bgBase = config.backgroundColor.slice(0, 7);
  const bgAlpha = config.backgroundColor.length === 9 ? config.backgroundColor.slice(7) : '80';
  const alphaPercent = Math.round((parseInt(bgAlpha, 16) / 255) * 100);

  return (
    <div className="bg-gray-50 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-blue-600 flex items-center gap-1">
              <Save className="w-3 h-3 animate-pulse" />
              جاري الحفظ...
            </span>
          )}
        </div>
        <button
          onClick={resetConfig}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
          title="إعادة تعيين"
        >
          <RotateCcw className="w-3 h-3" />
          إعادة تعيين
        </button>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-5">
        {/* Font Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">الخط</label>
            <FontSelector
              value={config.fontFamily}
              onChange={(font) => updateField('fontFamily', font)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">الوزن</label>
            <FontWeightSelector
              fontFamily={config.fontFamily}
              value={config.fontWeight}
              onChange={(w) => updateField('fontWeight', w)}
            />
          </div>
        </div>

        {/* Font Size */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-600">حجم الخط</label>
            <span className="text-xs text-gray-500">{currentFontSize}px</span>
          </div>
          <input
            type="range"
            min="16"
            max="48"
            value={currentFontSize}
            onChange={(e) => updateField('fontSize', `${e.target.value}px`)}
            className="w-full accent-blue-500 h-2"
          />
        </div>

        {/* Text Color */}
        <div>
          <label className="block text-xs text-gray-600 mb-2">لون النص</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={config.color}
              onChange={(e) => updateField('color', e.target.value)}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
            />
            <div className="flex gap-1.5 flex-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.color}
                  onClick={() => updateField('color', c.color)}
                  className={`flex-1 h-7 rounded border transition-all ${
                    config.color === c.color 
                      ? 'ring-2 ring-blue-500 ring-offset-1' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Background Color */}
        <div>
          <label className="block text-xs text-gray-600 mb-2">لون الخلفية</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bgBase}
              onChange={(e) => updateField('backgroundColor', `${e.target.value}${bgAlpha}`)}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
            />
            <div className="flex gap-1.5 flex-1">
              {BG_COLORS.map((c) => (
                <button
                  key={c.color}
                  onClick={() => updateField('backgroundColor', `${c.color}${bgAlpha}`)}
                  className={`flex-1 h-7 rounded border transition-all ${
                    bgBase === c.color 
                      ? 'ring-2 ring-blue-500 ring-offset-1' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Background Opacity */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-600">شفافية الخلفية</label>
            <span className="text-xs text-gray-500">{alphaPercent}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={alphaPercent}
            onChange={(e) => {
              const alpha = Math.round((parseInt(e.target.value) / 100) * 255).toString(16).padStart(2, '0');
              updateField('backgroundColor', `${bgBase}${alpha}`);
            }}
            className="w-full accent-blue-500 h-2"
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-xs text-gray-600 mb-2">الموضع</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'top-center', label: 'أعلى' },
              { value: 'center', label: 'وسط' },
              { value: 'bottom-center', label: 'أسفل' },
            ].map((pos) => (
              <button
                key={pos.value}
                onClick={() => updateField('position', pos.value)}
                className={`py-2 px-3 rounded text-sm transition-all ${
                  config.position === pos.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        {/* Effects Row */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 rounded px-3 py-2">
            <input
              type="checkbox"
              checked={config.bold || false}
              onChange={(e) => updateField('bold', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-blue-500"
            />
            <span className="text-sm text-gray-700">عريض</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 rounded px-3 py-2">
            <input
              type="checkbox"
              checked={config.italic || false}
              onChange={(e) => updateField('italic', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-blue-500"
            />
            <span className="text-sm text-gray-700">مائل</span>
          </label>
        </div>

        {/* Shadow */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-600">الظل</label>
            <span className="text-xs text-gray-500">{config.shadow || 0}</span>
          </div>
          <input
            type="range"
            min="0"
            max="8"
            value={config.shadow || 0}
            onChange={(e) => updateField('shadow', parseInt(e.target.value))}
            className="w-full accent-blue-500 h-2"
          />
        </div>
      </div>
    </div>
  );
};

export default SubtitleStylePanel;
