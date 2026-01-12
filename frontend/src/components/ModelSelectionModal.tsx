import React, { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, Zap, Crown, Check } from 'lucide-react';
import { API_CONFIG } from '../config/api';

interface LLMModel {
  id: string;
  name: string;
  description: string;
}

interface LLMModelStatus {
  current_model: string;
  available_models: LLMModel[];
}

interface ModelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelChanged?: () => void;
}

const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  onModelChanged 
}) => {
  const [status, setStatus] = useState<LLMModelStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/config/llm-model`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setSelectedModel(data.current_model);
      }
    } catch (error) {
      console.error('Failed to fetch LLM model status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  const handleSave = async () => {
    if (!selectedModel || selectedModel === status?.current_model) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/config/llm-model`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ caption_model: selectedModel }),
      });

      if (response.ok) {
        onModelChanged?.();
        onClose();
      } else {
        const error = await response.json();
        alert(`فشل في حفظ الإعدادات: ${error.detail}`);
      }
    } catch (error) {
      console.error('Failed to save model selection:', error);
      alert('فشل في حفظ الإعدادات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('pro')) {
      return <Crown className="w-5 h-5 text-purple-600" />;
    }
    return <Zap className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">اختيار نموذج الذكاء الاصطناعي</h2>
              <p className="text-sm text-gray-500">Gemini 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                اختر النموذج المناسب لإنشاء الترجمات. يمكنك التبديل بين النماذج في أي وقت.
              </p>

              {status?.available_models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                    selectedModel === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getModelIcon(model.id)}
                      <div>
                        <div className="font-semibold text-gray-900">{model.name}</div>
                        <div className="text-sm text-gray-500 mt-1">{model.description}</div>
                      </div>
                    </div>
                    {selectedModel === model.id && (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Model-specific badges */}
                  <div className="flex gap-2 mt-3 mr-8">
                    {model.id.includes('flash') && (
                      <>
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          ⚡ سريع
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          💰 اقتصادي
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          موصى به
                        </span>
                      </>
                    )}
                    {model.id.includes('pro') && (
                      <>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                          👑 جودة عالية
                        </span>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                          ترجمة أفضل
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={isSaving}
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedModel}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                جاري الحفظ...
              </>
            ) : (
              'حفظ'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelSelectionModal;
