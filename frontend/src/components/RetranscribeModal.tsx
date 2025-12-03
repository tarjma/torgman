import React, { useState } from 'react';
import { X, RefreshCw, Loader2, Languages } from 'lucide-react';
import SearchableLanguageSelect, { getLanguageName } from './SearchableLanguageSelect';

interface RetranscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetranscribe: (language: string) => void;
  isProcessing: boolean;
  currentLanguage?: string;
}

const RetranscribeModal: React.FC<RetranscribeModalProps> = ({
  isOpen,
  onClose,
  onRetranscribe,
  isProcessing,
  currentLanguage
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || 'auto');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRetranscribe(selectedLanguage);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">إعادة توليد الترجمات</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="p-6 text-center border-b bg-blue-50">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">جاري إعادة توليد الترجمات...</h3>
            <p className="text-gray-600 text-sm">
              قد يستغرق هذا عدة دقائق حسب طول الفيديو
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Current Language Display */}
          {currentLanguage && currentLanguage !== 'auto' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Languages className="w-4 h-4" />
                <span className="text-sm font-medium">اللغة الحالية: {getLanguageName(currentLanguage)}</span>
              </div>
            </div>
          )}

          {/* Language Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              اختر لغة الفيديو *
            </label>
            <SearchableLanguageSelect
              value={selectedLanguage}
              onChange={setSelectedLanguage}
              disabled={isProcessing}
              includeAuto={true}
            />
            <p className="text-xs text-gray-500">
              سيتم تحليل الصوت من جديد وإنشاء ترجمات جديدة بناءً على اللغة المختارة
            </p>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">تنبيه:</span> سيتم استبدال جميع الترجمات الحالية بترجمات جديدة. 
              أي تعديلات قمت بها سيتم فقدها.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري المعالجة...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  إعادة التوليد
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RetranscribeModal;
