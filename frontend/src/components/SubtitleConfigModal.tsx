import React, { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { SubtitleConfig } from '../types/subtitleConfig';
import { useSubtitleConfig } from '../hooks/useSubtitleConfig';
import { useFonts } from '../hooks/useFonts';
import FontSelector from './FontSelector';
import FontWeightSelector from './FontWeightSelector';

interface SubtitleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubtitleConfigModal: React.FC<SubtitleConfigModalProps> = ({ isOpen, onClose }) => {
  const { config, updateConfig, resetConfig, error, isLoading } = useSubtitleConfig();
  const { fontFamilies, validateFontFamily, validateFontWeight } = useFonts();
  const [localConfig, setLocalConfig] = useState<SubtitleConfig | null>(config);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  // Validate and fix font configuration when fonts are loaded
  useEffect(() => {
    if (fontFamilies.length > 0 && localConfig?.fontFamily) {
      const validatedFamily = validateFontFamily(localConfig.fontFamily);
      const validatedWeight = validateFontWeight(validatedFamily, localConfig.fontWeight);
      
      // Only update if validation changed something
      if (validatedFamily !== localConfig.fontFamily || validatedWeight !== localConfig.fontWeight) {
        setLocalConfig(prev => prev ? ({
          ...prev,
          fontFamily: validatedFamily,
          fontWeight: validatedWeight
        }) : null);
      }
    }
  }, [fontFamilies, localConfig?.fontFamily, localConfig?.fontWeight, validateFontFamily, validateFontWeight]);

  const handleSave = async () => {
    if (!localConfig) return;
    
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
    setLocalConfig(prev => prev ? ({ ...prev, [field]: value }) : null);
  };

  const handleFontFamilyChange = (fontFamily: string) => {
    if (!localConfig) return;
    
    // Validate the font family and weight
    const validatedFamily = validateFontFamily(fontFamily);
    const validatedWeight = validateFontWeight(validatedFamily, 'Regular');
    
    // Update both font family and weight
    setLocalConfig(prev => prev ? ({ 
      ...prev, 
      fontFamily: validatedFamily,
      fontWeight: validatedWeight
    }) : null);
  };

  if (!isOpen) return null;

  // Show loading state while config is being fetched
  if (!localConfig) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6">
          <div className="text-center">Loading configuration...</div>
        </div>
      </div>
    );
  }

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
                  <FontSelector
                    value={localConfig.fontFamily}
                    onChange={handleFontFamilyChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Weight
                  </label>
                  <FontWeightSelector
                    fontFamily={localConfig.fontFamily}
                    value={localConfig.fontWeight}
                    onChange={(fontWeight) => updateLocalConfig('fontWeight', fontWeight)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              
              {/* Margin Settings */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Margins
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Top</label>
                    <input
                      type="number"
                      value={localConfig.margin.top}
                      onChange={(e) => updateLocalConfig('margin', {
                        ...localConfig.margin,
                        top: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Right</label>
                    <input
                      type="number"
                      value={localConfig.margin.right}
                      onChange={(e) => updateLocalConfig('margin', {
                        ...localConfig.margin,
                        right: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bottom</label>
                    <input
                      type="number"
                      value={localConfig.margin.bottom}
                      onChange={(e) => updateLocalConfig('margin', {
                        ...localConfig.margin,
                        bottom: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Left</label>
                    <input
                      type="number"
                      value={localConfig.margin.left}
                      onChange={(e) => updateLocalConfig('margin', {
                        ...localConfig.margin,
                        left: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>
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
                    padding: localConfig.padding,
                    margin: `${localConfig.margin.top}px ${localConfig.margin.right}px ${localConfig.margin.bottom}px ${localConfig.margin.left}px`
                  }}
                >
                  Sample subtitle text
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
