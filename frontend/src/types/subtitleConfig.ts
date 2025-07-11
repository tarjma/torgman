export interface SubtitleConfig {
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  color: string;
  backgroundColor: string;
  textAlign: string;
  padding: string;
  borderRadius: string;
  textShadow: string;
  lineHeight: string;
  maxWidth: string;
  position: string;
  marginBottom: string;
  marginTop: string;
  showTranslation: boolean;
  translationColor: string;
  translationFontSize: string;
}

export const defaultSubtitleConfig: SubtitleConfig = {
  fontSize: '16px',
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'bold',
  color: '#ffffff',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  textAlign: 'center',
  padding: '8px 12px',
  borderRadius: '4px',
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
  lineHeight: '1.4',
  maxWidth: '80%',
  position: 'bottom-center',
  marginBottom: '60px',
  marginTop: '20px',
  showTranslation: false,
  translationColor: '#ffeb3b',
  translationFontSize: '14px'
};
