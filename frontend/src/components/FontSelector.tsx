import React from 'react';
import { useFonts } from '../hooks/useFonts';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface FontSelectorProps {
  value: string;
  onChange: (fontFamily: string) => void;
  disabled?: boolean;
  className?: string;
  showArabicWarning?: boolean;
}

const FontSelector: React.FC<FontSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = "",
  showArabicWarning = true
}) => {
  const { fontFamilies, loading: fontsLoading, error } = useFonts();

  const defaultClassName = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  
  // Find the selected font's Arabic support level
  const selectedFont = fontFamilies.find(f => f.name === value);
  const arabicSupport = selectedFont?.arabicSupport || 'unknown';

  // Get support level display info
  const getSupportInfo = (support: string) => {
    switch (support) {
      case 'full':
        return { label: 'دعم كامل للعربية', color: 'text-green-600', icon: CheckCircle };
      case 'partial':
        return { label: 'دعم جزئي للعربية', color: 'text-yellow-600', icon: AlertTriangle };
      case 'limited':
        return { label: 'دعم محدود - قد تظهر رموز غير مقروءة عند التصدير', color: 'text-red-600', icon: AlertTriangle };
      default:
        return null;
    }
  };

  const supportInfo = getSupportInfo(arabicSupport);

  return (
    <div className="space-y-1">
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
            <option value="Noto Sans Arabic">Noto Sans Arabic (افتراضي)</option>
          </>
        ) : (
          fontFamilies.map(fontFamily => {
            const support = fontFamily.arabicSupport;
            const indicator = support === 'full' ? '✓' : support === 'partial' ? '⚠' : support === 'limited' ? '⚠' : '';
            return (
              <option key={fontFamily.name} value={fontFamily.name}>
                {indicator} {fontFamily.name}
              </option>
            );
          })
        )}
      </select>
      
      {/* Arabic support warning */}
      {showArabicWarning && supportInfo && arabicSupport !== 'full' && (
        <div className={`flex items-center gap-1.5 text-xs ${supportInfo.color}`}>
          <supportInfo.icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{supportInfo.label}</span>
        </div>
      )}
    </div>
  );
};

export default FontSelector;
