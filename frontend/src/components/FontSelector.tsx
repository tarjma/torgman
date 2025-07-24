import React from 'react';
import { useFonts } from '../hooks/useFonts';

interface FontSelectorProps {
  value: string;
  onChange: (fontFamily: string) => void;
  disabled?: boolean;
  className?: string;
}

const FontSelector: React.FC<FontSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = ""
}) => {
  const { fontFamilies, loading: fontsLoading, error } = useFonts();

  const defaultClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || defaultClassName}
      disabled={disabled || fontsLoading}
    >
      {fontsLoading ? (
        <option>جاري تحميل الخطوط...</option>
      ) : error ? (
        <option>خطأ في تحميل الخطوط</option>
      ) : fontFamilies.length === 0 ? (
        <>
          <option value="Cairo">Cairo (افتراضي)</option>
          <option value="Noto Sans Arabic">Noto Sans Arabic</option>
          <option value="Tajawal">Tajawal</option>
        </>
      ) : (
        fontFamilies.map(fontFamily => (
          <option key={fontFamily.name} value={fontFamily.name}>
            {fontFamily.name} ({fontFamily.weights.length} أوزان)
          </option>
        ))
      )}
    </select>
  );
};

export default FontSelector;
