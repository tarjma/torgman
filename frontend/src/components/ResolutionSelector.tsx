import React from 'react';

interface ResolutionSelectorProps {
  value: string;
  onChange: (resolution: string) => void;
  disabled?: boolean;
}

const ResolutionSelector: React.FC<ResolutionSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  return (
    <div className="space-y-2">
      <label htmlFor="resolution" className="block text-sm font-medium text-gray-700">
        جودة الفيديو
      </label>
      <select
        id="resolution"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        disabled={disabled}
      >
        <option value="144p">144p - جودة منخفضة</option>
        <option value="240p">240p - جودة منخفضة</option>
        <option value="360p">360p - جودة متوسطة</option>
        <option value="480p">480p - جودة متوسطة</option>
        <option value="720p">720p - جودة عالية (موصى بها)</option>
        <option value="1080p">1080p - جودة عالية جداً</option>
        <option value="best">أفضل جودة متاحة</option>
      </select>
      <p className="text-xs text-gray-500">
        جودة أعلى = ملف أكبر وتحميل أطول، لكن صوت أوضح
      </p>
    </div>
  );
};

export default ResolutionSelector;
