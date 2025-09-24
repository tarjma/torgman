import React, { useState, useCallback } from 'react';
import { X, Key, Info, AlertTriangle, Check } from 'lucide-react';
import { useApiKey } from '../hooks/useApiKey';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeyChanged?: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onApiKeyChanged }) => {
  const { status, setApiKey, clearApiKey, isLoading } = useApiKey();
  const [inputApiKey, setInputApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSetApiKey = useCallback(async () => {
    if (!inputApiKey.trim()) {
      alert('يرجى إدخال مفتاح API صحيح');
      return;
    }

    try {
      setIsSubmitting(true);
      await setApiKey(inputApiKey.trim());
      setInputApiKey('');
      alert('تم حفظ مفتاح API بنجاح!');
      onApiKeyChanged?.(); // Notify parent component
      onClose();
    } catch (error) {
      console.error('Failed to set API key:', error);
      alert('فشل في حفظ مفتاح API. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  }, [inputApiKey, setApiKey, onClose, onApiKeyChanged]);

  const handleClearApiKey = useCallback(async () => {
    if (confirm('هل أنت متأكد من حذف مفتاح API؟ سيتم استخدام المفتاح من متغيرات النظام إن وجد.')) {
      try {
        setIsSubmitting(true);
        await clearApiKey();
        alert('تم حذف مفتاح API بنجاح!');
        onApiKeyChanged?.(); // Notify parent component
        onClose();
      } catch (error) {
        console.error('Failed to clear API key:', error);
        alert('فشل في حذف مفتاح API. يرجى المحاولة مرة أخرى.');
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [clearApiKey, onClose, onApiKeyChanged]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">إعداد مفتاح Gemini API</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Status */}
          {!isLoading && status && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-900">الحالة الحالية</span>
              </div>
              <div className="flex items-center gap-2">
                {status.has_api_key ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-700">
                      مفتاح API متوفر 
                      {status.api_key_source === 'environment' ? ' (من متغيرات النظام)' : ' (مدخل من المستخدم)'}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-red-700">لا يوجد مفتاح API</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              مفتاح Gemini API
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                placeholder="أدخل مفتاح Gemini API الخاص بك"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKey ? 'إخفاء' : 'إظهار'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              يمكنك الحصول على مفتاح API من{' '}
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          {/* Warning */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">تنبيه أمني</p>
                <p>سيتم حفظ مفتاح API محلياً على جهازك. تأكد من عدم مشاركة هذا المفتاح مع أي شخص آخر.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-4 flex justify-between items-center">
          {status?.has_api_key && status.api_key_source === 'user_set' && (
            <button
              onClick={handleClearApiKey}
              disabled={isSubmitting}
              className="px-4 py-2 text-red-600 hover:text-red-800 font-medium transition-colors disabled:opacity-50"
            >
              حذف المفتاح
            </button>
          )}
          
          <div className="flex gap-3 mr-auto">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button
              onClick={handleSetApiKey}
              disabled={isSubmitting || !inputApiKey.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
