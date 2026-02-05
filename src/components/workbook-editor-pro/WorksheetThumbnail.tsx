/**
 * WorksheetThumbnail - HTML náhled pracovního listu
 * 
 * Renderuje miniaturní náhled worksheetu pomocí HTML/CSS
 * s lazy loading a optimalizovaným výkonem.
 */

import { useRef, useState, useEffect, memo } from 'react';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { Worksheet, WorksheetBlock } from '../../types/worksheet';

interface WorksheetThumbnailProps {
  worksheet: Worksheet | null;
  pageIndex?: number; // Pro multi-page worksheets
  showPageNumber?: boolean;
  className?: string;
}

/**
 * Renderuje zjednodušený blok pro thumbnail
 */
function ThumbnailBlock({ block, scale }: { block: WorksheetBlock; scale: number }) {
  const fontSize = Math.max(4, 10 * scale);
  
  switch (block.type) {
    case 'title':
      return (
        <div 
          className="w-full mb-1"
          style={{ 
            fontSize: fontSize * 1.5,
            fontWeight: 700,
            color: '#1e293b',
            lineHeight: 1.2,
          }}
        >
          {block.content?.text || 'Nadpis'}
        </div>
      );
      
    case 'subtitle':
      return (
        <div 
          className="w-full mb-1"
          style={{ 
            fontSize: fontSize * 1.2,
            fontWeight: 600,
            color: '#475569',
            lineHeight: 1.2,
          }}
        >
          {block.content?.text || 'Podnadpis'}
        </div>
      );
      
    case 'text':
      return (
        <div 
          className="w-full mb-1"
          style={{ 
            fontSize,
            color: '#64748b',
            lineHeight: 1.3,
          }}
        >
          {/* Zkrácený text pro thumbnail */}
          <div className="w-3/4 h-1 bg-slate-300 rounded mb-0.5" />
          <div className="w-full h-1 bg-slate-200 rounded mb-0.5" />
          <div className="w-5/6 h-1 bg-slate-200 rounded" />
        </div>
      );
      
    case 'image':
      return (
        <div 
          className="w-full bg-slate-100 rounded flex items-center justify-center mb-1"
          style={{ 
            height: 30 * scale,
            minHeight: 15,
          }}
        >
          <div className="w-4 h-4 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
          </div>
        </div>
      );
      
    case 'task':
    case 'exercise':
      return (
        <div 
          className="w-full border border-slate-200 rounded p-1 mb-1 bg-blue-50/50"
          style={{ fontSize }}
        >
          <div className="flex items-start gap-1">
            <div className="w-3 h-3 border-2 border-blue-400 rounded-sm flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="w-full h-1 bg-blue-200 rounded mb-0.5" />
              <div className="w-3/4 h-1 bg-blue-100 rounded" />
            </div>
          </div>
        </div>
      );
      
    case 'lines':
      const lineCount = block.settings?.lineCount || 3;
      return (
        <div className="w-full mb-1">
          {Array.from({ length: Math.min(lineCount, 4) }).map((_, i) => (
            <div 
              key={i} 
              className="w-full border-b border-slate-300 mb-1"
              style={{ height: 8 * scale }}
            />
          ))}
        </div>
      );
      
    case 'gap':
      return (
        <div 
          className="w-full"
          style={{ height: (block.settings?.height || 20) * scale }}
        />
      );
      
    default:
      return (
        <div 
          className="w-full bg-slate-50 rounded mb-1"
          style={{ height: 20 * scale }}
        />
      );
  }
}

/**
 * Hlavní komponenta pro thumbnail
 */
export const WorksheetThumbnail = memo(function WorksheetThumbnail({
  worksheet,
  pageIndex = 0,
  showPageNumber = true,
  className = '',
}: WorksheetThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Lazy loading s IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  // Simulace načítání
  useEffect(() => {
    if (isVisible && worksheet) {
      const timer = setTimeout(() => setIsLoading(false), 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, worksheet]);
  
  // Škála pro thumbnail (zmenšení obsahu)
  const scale = 0.4;
  
  // Získej bloky pro danou stránku (pokud je multi-page)
  const blocks = worksheet?.blocks || [];
  
  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-white overflow-hidden ${className}`}
    >
      {/* Border overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 border border-black/5 rounded-[1px]" />
      
      {/* Content */}
      {isVisible && worksheet && !isLoading ? (
        <div 
          className="absolute inset-0 p-2 overflow-hidden"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
          }}
        >
          {/* Header area */}
          <div className="w-full mb-2 pb-2 border-b border-slate-100">
            <div className="text-sm font-bold text-slate-800 truncate">
              {worksheet.title || 'Pracovní list'}
            </div>
            {worksheet.subtitle && (
              <div className="text-xs text-slate-500 truncate mt-0.5">
                {worksheet.subtitle}
              </div>
            )}
          </div>
          
          {/* Blocks */}
          <div className="space-y-1">
            {blocks.slice(0, 8).map((block) => (
              <ThumbnailBlock key={block.id} block={block} scale={scale * 2} />
            ))}
            
            {blocks.length > 8 && (
              <div className="text-center text-slate-400" style={{ fontSize: 8 }}>
                +{blocks.length - 8} dalších...
              </div>
            )}
          </div>
        </div>
      ) : (
        // Loading / placeholder
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : !worksheet ? (
            <>
              <FileText className="w-6 h-6 mb-1" />
              <span className="text-[8px]">Prázdná stránka</span>
            </>
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400" />
          )}
        </div>
      )}
      
      {/* Page number */}
      {showPageNumber && worksheet && (
        <div className="absolute bottom-1 right-1.5 text-[8px] text-slate-400 font-medium">
          {pageIndex + 1}
        </div>
      )}
    </div>
  );
});
