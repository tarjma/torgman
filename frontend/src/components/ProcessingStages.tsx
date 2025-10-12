import React from 'react';
import { Check, Loader2 } from 'lucide-react';

interface ProcessingStagesProps {
  currentStage: string;
  progress: number;
}

const stages = [
  { key: 'downloading_video', label: 'تحميل', range: [0, 20] },
  { key: 'extracting_audio', label: 'الصوت', range: [20, 35] },
  { key: 'generating_subtitles', label: 'الترجمة', range: [35, 90] },
  { key: 'saving_data', label: 'الحفظ', range: [90, 100] }
];

const ProcessingStages: React.FC<ProcessingStagesProps> = ({ currentStage, progress }) => {
  const getCurrentStageIndex = () => {
    const index = stages.findIndex(s => s.key === currentStage);
    return index >= 0 ? index : 0;
  };
  
  const currentIndex = getCurrentStageIndex();
  
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {stages.map((stage, index) => {
          const isComplete = progress >= stage.range[1];
          const isCurrent = index === currentIndex;
          
          return (
            <React.Fragment key={stage.key}>
              {/* Stage Circle */}
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isComplete ? 'bg-green-500' :
                  isCurrent ? 'bg-blue-600 animate-pulse' :
                  'bg-gray-300'
                }`}>
                  {isComplete ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <span className="text-xs text-white">{index + 1}</span>
                  )}
                </div>
                <span className={`text-xs mt-1 text-center ${
                  isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'
                }`}>
                  {stage.label}
                </span>
              </div>
              
              {/* Connector Line */}
              {index < stages.length - 1 && (
                <div className={`h-1 flex-1 mx-2 rounded transition-all duration-300 ${
                  progress >= stage.range[1] ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessingStages;
