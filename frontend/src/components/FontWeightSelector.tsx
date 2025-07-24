import React from 'react';
import { useFonts } from '../hooks/useFonts';

interface FontWeightSelectorProps {
  fontFamily: string;
  value: string;
  onChange: (fontWeight: string) => void;
  disabled?: boolean;
  className?: string;
}

const FontWeightSelector: React.FC<FontWeightSelectorProps> = ({
  fontFamily,
  value,
  onChange,
  disabled = false,
  className = ""
}) => {
  const { fontFamilies, loading: fontsLoading, error } = useFonts();

  const defaultClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  // Find the selected font family and its available weights
  const selectedFontFamily = fontFamilies.find(family => family.name === fontFamily);
  const availableWeights = selectedFontFamily?.weights || [];

  // Weight display mapping
  const weightLabels: { [key: string]: string } = {
    'Thin': 'رفيع',
    'ExtraLight': 'رفيع إضافي',
    'Light': 'خفيف',
    'Regular': 'عادي',
    'Medium': 'متوسط',
    'SemiBold': 'شبه عريض',
    'Bold': 'عريض',
    'ExtraBold': 'عريض إضافي',
    'Black': 'أسود'
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || defaultClassName}
      disabled={disabled || fontsLoading}
    >
      {fontsLoading ? (
        <option>جاري تحميل أوزان الخط...</option>
      ) : error ? (
        <option>خطأ في تحميل أوزان الخط</option>
      ) : availableWeights.length === 0 ? (
        <>
          <option value="Regular">عادي</option>
          <option value="Bold">عريض</option>
          <option value="Light">خفيف</option>
          <option value="Medium">متوسط</option>
        </>
      ) : (
        availableWeights.map(weight => (
          <option key={weight} value={weight}>
            {weightLabels[weight] || weight}
          </option>
        ))
      )}
    </select>
  );
};

export default FontWeightSelector;
