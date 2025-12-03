import React, { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';

interface RegenerateCaptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
}

interface CaptionParams {
  max_chars_per_line: number;
  max_lines_per_caption: number;
  max_caption_duration: number;
  max_cps: number;
}

const RegenerateCaptionsModal: React.FC<RegenerateCaptionsModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}) => {
  const [params, setParams] = useState<CaptionParams>({
    max_chars_per_line: 42,
    max_lines_per_caption: 2,
    max_caption_duration: 7,
    max_cps: 17,
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/regenerate-captions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to regenerate captions');
      }

      await response.json();
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('حدث خطأ أثناء إعادة إنشاء الترجمات');
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const updateParam = (key: keyof CaptionParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">تخصيص إعدادات الترجمة</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-6">
          {/* Max Characters Per Line */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحد الأقصى للأحرف في السطر: {params.max_chars_per_line}
            </label>
            <input
              type="range"
              min="30"
              max="50"
              value={params.max_chars_per_line}
              onChange={(e) => updateParam('max_chars_per_line', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30 (ضيق)</span>
              <span>50 (واسع)</span>
            </div>
          </div>

          {/* Max Lines Per Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحد الأقصى لعدد الأسطر
            </label>
            <select
              value={params.max_lines_per_caption}
              onChange={(e) => updateParam('max_lines_per_caption', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">سطر واحد</option>
              <option value="2">سطرين</option>
            </select>
          </div>

          {/* Max Caption Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الحد الأقصى لمدة الترجمة: {params.max_caption_duration} ثانية
            </label>
            <input
              type="range"
              min="5"
              max="10"
              value={params.max_caption_duration}
              onChange={(e) => updateParam('max_caption_duration', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5 ث (سريع)</span>
              <span>10 ث (بطيء)</span>
            </div>
          </div>

          {/* Max Characters Per Second (CPS) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              سرعة القراءة القصوى (حرف/ث): {params.max_cps}
            </label>
            <input
              type="range"
              min="15"
              max="25"
              value={params.max_cps}
              onChange={(e) => updateParam('max_cps', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>15 (مريح)</span>
              <span>25 (سريع)</span>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              القيم الأقل = قراءة أكثر راحة. الموصى به: 17-20
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isRegenerating}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRegenerating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>جاري إعادة الإنشاء...</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>إعادة إنشاء الترجمات</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          <strong>ملاحظة:</strong> سيتم إعادة إنشاء جميع الترجمات بالإعدادات الجديدة. 
          سيتم الحفاظ على الترجمات الموجودة قدر الإمكان.
        </div>
      </div>
    </div>
  );
};

export default RegenerateCaptionsModal;
