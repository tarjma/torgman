import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

// Complete Whisper language support (99 languages)
export const LANGUAGE_MAP: { [key: string]: string } = {
  'en': 'الإنجليزية',
  'zh': 'الصينية',
  'de': 'الألمانية',
  'es': 'الإسبانية',
  'ru': 'الروسية',
  'ko': 'الكورية',
  'fr': 'الفرنسية',
  'ja': 'اليابانية',
  'pt': 'البرتغالية',
  'tr': 'التركية',
  'pl': 'البولندية',
  'ca': 'الكتالانية',
  'nl': 'الهولندية',
  'ar': 'العربية',
  'sv': 'السويدية',
  'it': 'الإيطالية',
  'id': 'الإندونيسية',
  'hi': 'الهندية',
  'fi': 'الفنلندية',
  'vi': 'الفيتنامية',
  'he': 'العبرية',
  'uk': 'الأوكرانية',
  'el': 'اليونانية',
  'ms': 'الماليزية',
  'cs': 'التشيكية',
  'ro': 'الرومانية',
  'da': 'الدنماركية',
  'hu': 'الهنغارية',
  'ta': 'التاميلية',
  'no': 'النرويجية',
  'th': 'التايلاندية',
  'ur': 'الأردية',
  'hr': 'الكرواتية',
  'bg': 'البلغارية',
  'lt': 'الليتوانية',
  'la': 'اللاتينية',
  'mi': 'الماورية',
  'ml': 'المالايالامية',
  'cy': 'الويلزية',
  'sk': 'السلوفاكية',
  'te': 'التيلوغوية',
  'fa': 'الفارسية',
  'lv': 'اللاتفية',
  'bn': 'البنغالية',
  'sr': 'الصربية',
  'az': 'الأذربيجانية',
  'sl': 'السلوفينية',
  'kn': 'الكانادية',
  'et': 'الإستونية',
  'mk': 'المقدونية',
  'br': 'البريتونية',
  'eu': 'الباسكية',
  'is': 'الآيسلندية',
  'hy': 'الأرمينية',
  'ne': 'النيبالية',
  'mn': 'المنغولية',
  'bs': 'البوسنية',
  'kk': 'الكازاخستانية',
  'sq': 'الألبانية',
  'sw': 'السواحيلية',
  'gl': 'الجاليكية',
  'mr': 'الماراثية',
  'pa': 'البنجابية',
  'si': 'السنهالية',
  'km': 'الخميرية',
  'sn': 'الشونا',
  'yo': 'اليوروبا',
  'so': 'الصومالية',
  'af': 'الأفريكانية',
  'oc': 'الأوكسيتانية',
  'ka': 'الجورجية',
  'be': 'البيلاروسية',
  'tg': 'الطاجيكية',
  'sd': 'السندية',
  'gu': 'الغوجاراتية',
  'am': 'الأمهرية',
  'yi': 'اليديشية',
  'lo': 'اللاوية',
  'uz': 'الأوزبكية',
  'fo': 'الفاروية',
  'ht': 'الكريولية الهايتية',
  'ps': 'الباشتو',
  'tk': 'التركمانية',
  'nn': 'النينورسك',
  'mt': 'المالطية',
  'sa': 'السنسكريتية',
  'lb': 'اللوكسمبورغية',
  'my': 'البورمية',
  'bo': 'التبتية',
  'tl': 'التاغالوغية',
  'mg': 'المالاغاسية',
  'as': 'الأسامية',
  'tt': 'التترية',
  'haw': 'الهاوائية',
  'ln': 'اللينغالا',
  'ha': 'الهوسا',
  'ba': 'الباشكيرية',
  'jw': 'الجاوية',
  'su': 'السوندانية',
  'yue': 'الكانتونية'
};

// Helper function to get language name with fallback
export function getLanguageName(code: string): string {
  if (code === 'auto') return 'كشف تلقائي';
  const baseCode = code.split('-')[0];
  return LANGUAGE_MAP[code] || LANGUAGE_MAP[baseCode] || code;
}

interface SearchableLanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  includeAuto?: boolean;
  className?: string;
}

const SearchableLanguageSelect: React.FC<SearchableLanguageSelectProps> = ({ 
  value, 
  onChange, 
  disabled = false, 
  includeAuto = true,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter languages based on search query
  const filteredLanguages = Object.entries(LANGUAGE_MAP).filter(([code, name]) => {
    const query = searchQuery.toLowerCase();
    return name.includes(query) || code.toLowerCase().includes(query);
  });

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getDisplayValue = () => {
    return getLanguageName(value);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 bg-white text-right flex items-center justify-between"
      >
        <span>{getDisplayValue()}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن اللغة..."
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Language options */}
          <div className="overflow-y-auto max-h-64">
            {includeAuto && searchQuery === '' && (
              <button
                type="button"
                onClick={() => handleSelect('auto')}
                className={`w-full px-3 py-2 text-right hover:bg-blue-50 transition-colors ${
                  value === 'auto' ? 'bg-blue-100 font-medium' : ''
                }`}
              >
                كشف تلقائي
              </button>
            )}
            
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map(([code, name]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleSelect(code)}
                  className={`w-full px-3 py-2 text-right hover:bg-blue-50 transition-colors ${
                    value === code ? 'bg-blue-100 font-medium' : ''
                  }`}
                >
                  {name}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                لم يتم العثور على نتائج
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableLanguageSelect;
