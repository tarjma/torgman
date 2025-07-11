import React, { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { SubtitleConfig } from '../types/subtitleConfig';
import { useSubtitleConfig } from '../hooks/useSubtitleConfig';

interface SubtitleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubtitleConfigModal: React.FC<SubtitleConfigModalProps> = ({ isOpen, onClose }) => {
  const { config, updateConfig, resetConfig, error } = useSubtitleConfig();
  const [localConfig, setLocalConfig] = useState<SubtitleConfig>(config);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateConfig(localConfig);
      onClose();
    } catch (err) {
      console.error('Failed to save subtitle configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetConfig();
      onClose();
    } catch (err) {
      console.error('Failed to reset subtitle configuration:', err);
    }
  };

  const updateLocalConfig = (field: keyof SubtitleConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Subtitle Configuration</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Font Settings */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Font Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Size
                  </label>
                  <input
                    type="text"
                    value={localConfig.fontSize}
                    onChange={(e) => updateLocalConfig('fontSize', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="16px"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Family
                  </label>
                  <select
                    value={localConfig.fontFamily}
                    onChange={(e) => updateLocalConfig('fontFamily', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="Helvetica, sans-serif">Helvetica</option>
                    <option value="Georgia, serif">Georgia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Weight
                  </label>
                  <select
                    value={localConfig.fontWeight}
                    onChange={(e) => updateLocalConfig('fontWeight', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="lighter">Lighter</option>
                    <option value="bolder">Bolder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Line Height
                  </label>
                  <input
                    type="text"
                    value={localConfig.lineHeight}
                    onChange={(e) => updateLocalConfig('lineHeight', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1.4"
                  />
                </div>
              </div>
            </div>

            {/* Color Settings */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Color Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={localConfig.color}
                      onChange={(e) => updateLocalConfig('color', e.target.value)}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={localConfig.color}
                      onChange={(e) => updateLocalConfig('color', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Background Color
                  </label>
                  <input
                    type="text"
                    value={localConfig.backgroundColor}
                    onChange={(e) => updateLocalConfig('backgroundColor', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="rgba(0, 0, 0, 0.7)"
                  />
                </div>
              </div>
            </div>

            {/* Position Settings */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Position Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position
                  </label>
                  <select
                    value={localConfig.position}
                    onChange={(e) => updateLocalConfig('position', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="top-center">Top Center</option>
                    <option value="center">Center</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bottom Margin
                  </label>
                  <input
                    type="text"
                    value={localConfig.marginBottom}
                    onChange={(e) => updateLocalConfig('marginBottom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="60px"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Width
                  </label>
                  <input
                    type="text"
                    value={localConfig.maxWidth}
                    onChange={(e) => updateLocalConfig('maxWidth', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="80%"
                  />
                </div>
              </div>
            </div>

            {/* Translation Settings */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Translation Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="showTranslation"
                    checked={localConfig.showTranslation}
                    onChange={(e) => updateLocalConfig('showTranslation', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="showTranslation" className="text-sm font-medium text-gray-700">
                    Show translation alongside original text
                  </label>
                </div>
                {localConfig.showTranslation && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Translation Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={localConfig.translationColor}
                          onChange={(e) => updateLocalConfig('translationColor', e.target.value)}
                          className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={localConfig.translationColor}
                          onChange={(e) => updateLocalConfig('translationColor', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Translation Font Size
                      </label>
                      <input
                        type="text"
                        value={localConfig.translationFontSize}
                        onChange={(e) => updateLocalConfig('translationFontSize', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="14px"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Preview</h3>
              <div className="bg-gray-900 relative rounded-lg h-32 flex items-center justify-center">
                <div 
                  className="text-center max-w-[80%] px-4 py-2 rounded"
                  style={{
                    fontFamily: localConfig.fontFamily,
                    fontSize: localConfig.fontSize,
                    fontWeight: localConfig.fontWeight,
                    color: localConfig.color,
                    backgroundColor: localConfig.backgroundColor,
                    lineHeight: localConfig.lineHeight,
                    textShadow: localConfig.textShadow,
                    borderRadius: localConfig.borderRadius,
                    padding: localConfig.padding
                  }}
                >
                  Sample subtitle text
                  {localConfig.showTranslation && (
                    <div 
                      style={{
                        color: localConfig.translationColor,
                        fontSize: localConfig.translationFontSize,
                        marginTop: '4px'
                      }}
                    >
                      نص الترجمة التجريبي
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubtitleConfigModal;
