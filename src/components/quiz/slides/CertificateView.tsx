/**
 * Certificate View
 * 
 * Renders a certificate with data from form fields
 * Includes download functionality
 */

import React, { useRef, useState, useEffect } from 'react';
import { Download, Award, Loader2 } from 'lucide-react';
import { ToolsSlide, CertificateFieldSource } from '../../../types/quiz';

interface CertificateViewProps {
  slide: ToolsSlide;
  quiz?: any;
  formResponses?: Record<string, Record<string, string | string[]>>; // slideId -> fieldId -> value
  isPreview?: boolean;
}

// Resolve field source to actual value
function resolveFieldValue(
  source: CertificateFieldSource | undefined,
  formResponses: Record<string, Record<string, string | string[]>>,
  defaultValue: string = ''
): string {
  if (!source) return defaultValue;

  switch (source.type) {
    case 'manual':
      return source.value || defaultValue;
    case 'auto':
      // Auto generates today's date
      return new Date().toLocaleDateString('cs-CZ');
    case 'form-field':
      if (source.slideId && source.fieldId) {
        const slideResponses = formResponses[source.slideId];
        if (slideResponses) {
          const value = slideResponses[source.fieldId];
          if (Array.isArray(value)) {
            return value.join(', ');
          }
          return value || defaultValue;
        }
      }
      return defaultValue;
    default:
      return defaultValue;
  }
}

// Load image as base64 data URL (handles CORS)
async function loadImageAsDataUrl(url: string): Promise<string> {
  // Try fetch first (works with proper CORS headers)
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    // Fallback: try loading via Image with crossOrigin
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            reject(new Error('Could not get canvas context'));
          }
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });
  }
}

export function CertificateView({ slide, quiz, formResponses = {}, isPreview = false }: CertificateViewProps) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const config = slide.certificateConfig;

  // Preload custom image as data URL to avoid CORS issues
  useEffect(() => {
    if (config?.customPdfUrl) {
      loadImageAsDataUrl(config.customPdfUrl)
        .then(dataUrl => setImageDataUrl(dataUrl))
        .catch(e => {
          console.error('Error loading image:', e);
          // Keep original URL as fallback for display
          setImageDataUrl(null);
        });
    }
  }, [config?.customPdfUrl]);

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-slate-500">
          <Award className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>Certifikát není nakonfigurován</p>
        </div>
      </div>
    );
  }

  // Resolve values from sources
  const participantName = resolveFieldValue(config.nameSource, formResponses, isPreview ? 'Jméno účastníka' : '');
  const dateOfBirth = resolveFieldValue(config.dateOfBirthSource, formResponses, '');
  const issueDate = resolveFieldValue(config.issueDate, formResponses, new Date().toLocaleDateString('cs-CZ'));

  // Download by drawing on canvas manually (bypasses CORS issues)
  const handleDownload = async () => {
    if (!config.customPdfUrl) {
      alert('Pro stažení je potřeba vlastní šablona certifikátu.');
      return;
    }

    setIsDownloading(true);
    try {
      // Load image as data URL
      const dataUrl = imageDataUrl || await loadImageAsDataUrl(config.customPdfUrl);
      
      // Create image element
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      });

      // Create canvas with image dimensions
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw background image
      ctx.drawImage(img, 0, 0);

      // Draw name text (at 65% from top)
      const nameY = canvas.height * 0.65;
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.textAlign = 'center';
      ctx.fillText(participantName || '___________________', canvas.width / 2, nameY);

      // Draw date of birth (at 80% from top)
      if (dateOfBirth) {
        const dateY = canvas.height * 0.80;
        ctx.font = '24px Arial, sans-serif';
        ctx.fillStyle = '#475569'; // slate-600
        ctx.fillText(`nar.: ${dateOfBirth}`, canvas.width / 2, dateY);
      }

      // Download
      const link = document.createElement('a');
      link.download = `certifikat-${participantName || 'ucastnik'}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Nepodařilo se stáhnout certifikát. Zkuste screenshot (Cmd+Shift+4 nebo Print Screen).');
    } finally {
      setIsDownloading(false);
    }
  };

  // Check if using custom PDF template
  const hasCustomTemplate = !!config.customPdfUrl;

  return (
    <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto bg-transparent">
      {/* Certificate container - A4 landscape ratio (297/210 = 1.414) */}
      <div
        ref={certificateRef}
        style={{
          width: '90%',
          maxWidth: '842px', // A4 landscape width at 72dpi
          aspectRatio: '1.414', // A4 landscape (297/210)
          position: 'relative',
          backgroundColor: hasCustomTemplate ? 'transparent' : '#ffffff',
        }}
      >
        {hasCustomTemplate ? (
          // Custom PDF template view
          <div className="w-full h-full relative">
            <img 
              src={imageDataUrl || config.customPdfUrl} 
              alt="Certificate template" 
              className="w-full h-full object-contain"
            />
            {/* Overlay name - positioned 65% from top */}
            <div 
              className="absolute text-center w-full"
              style={{ 
                top: config.customNamePosition?.top || '65%',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <p 
                className="font-bold text-slate-800"
                style={{ fontSize: 'clamp(24px, 4vw, 42px)' }}
              >
                {participantName || '___________________'}
              </p>
            </div>
            {/* Date of birth - positioned 80% from top */}
            {dateOfBirth && (
              <div 
                className="absolute text-center w-full"
                style={{ 
                  top: config.customDatePosition?.top || '80%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                <p className="text-base text-slate-600">nar.: {dateOfBirth}</p>
              </div>
            )}
          </div>
        ) : (
          // Default certificate design
          <>
            {/* Rainbow border */}
            <div
              style={{
                position: 'absolute',
                inset: '6px',
                border: '3px solid transparent',
                borderImage: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3) 1',
                pointerEvents: 'none',
              }}
            />

            {/* Inner border */}
            <div
              style={{
                position: 'absolute',
                inset: '16px',
                border: '2px solid #c4b5fd',
                pointerEvents: 'none',
              }}
            />

            {/* Content */}
            <div className="relative h-full flex flex-col p-8">
              {/* Title section */}
              <div className="text-center mb-6">
                <h1
                  className="font-bold tracking-[0.3em] text-slate-800"
                  style={{ fontSize: 'clamp(20px, 4vw, 36px)' }}
                >
                  {config.title}
                </h1>
                {config.subtitle && (
                  <h2
                    className="font-bold tracking-[0.2em] text-slate-700 mt-1"
                    style={{ fontSize: 'clamp(14px, 2.5vw, 24px)' }}
                  >
                    {config.subtitle}
                  </h2>
                )}
                {config.organizationName && (
                  <p className="text-slate-600 mt-3 text-sm font-medium">
                    {config.organizationName}
                  </p>
                )}
              </div>

              {/* Decorative image area */}
              <div 
                className="flex-1 flex items-center justify-center rounded-lg mb-6"
                style={{ backgroundColor: '#e0e7ff', minHeight: '100px' }}
              >
                <Award className="w-16 h-16 text-violet-400 opacity-50" />
              </div>

              {/* Participant info */}
              <div className="text-center mb-6">
                <p className="text-xs text-slate-500 mb-1">OSVĚDČENÍ O ÚČASTI</p>
                <p className="text-xl font-bold text-slate-800 mb-1">{participantName || '___________________'}</p>
                {dateOfBirth && (
                  <p className="text-xs text-slate-600">narozen/a: {dateOfBirth}</p>
                )}
              </div>

              {/* Bottom columns */}
              {config.columns && config.columns.length > 0 && (
                <div 
                  className="grid gap-3 mt-auto pt-3 border-t border-slate-200"
                  style={{ gridTemplateColumns: `repeat(${config.columns.length}, 1fr)` }}
                >
                  {config.columns.map((column, index) => (
                    <div key={index} className="text-center">
                      <p className="text-[10px] text-slate-500 font-medium mb-0.5">{column.title}</p>
                      <p className="text-[10px] text-slate-600 whitespace-pre-wrap leading-tight">{column.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Issue date */}
              <div className="text-center mt-3">
                <p className="text-[10px] text-slate-500">Vydáno dne: {issueDate}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Download button - always visible at bottom */}
      <button
        onClick={handleDownload}
        disabled={(!participantName && !isPreview) || isDownloading}
        className="mt-6 flex items-center gap-2 px-8 py-3 border-2 border-violet-600 text-violet-600 hover:bg-violet-50 disabled:border-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generuji...
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Stáhnout certifikát
          </>
        )}
      </button>

      {/* Missing name message */}
      {!isPreview && !participantName && (
        <p className="mt-3 text-sm text-amber-600">
          Pro stažení certifikátu je potřeba vyplnit jméno
        </p>
      )}
    </div>
  );
}
