/**
 * Quiz Preview Component
 * 
 * Uses the EXACT same design as QuizViewPage
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Menu,
  PanelLeftClose,
  ExternalLink,
  Globe,
  Youtube,
  MessageSquare,
  Send,
  User,
  Loader2,
} from 'lucide-react';
import {
  Quiz,
  QuizSlide,
  ABCActivitySlide,
  OpenActivitySlide,
  ExampleActivitySlide,
  BoardActivitySlide,
  VotingActivitySlide,
  ConnectPairsActivitySlide,
  FillBlanksActivitySlide,
  ImageHotspotsActivitySlide,
  VideoQuizActivitySlide,
  InfoSlide,
  SlideResponse,
  calculateQuizScore,
  getTemplateById,
} from '../../types/quiz';
import { MathText } from '../math/MathText';
import { AutoScaleQuestion } from './AutoScaleQuestion';
import { BoardSlideView } from './slides/BoardSlideView';
import { VotingSlideView } from './slides/VotingSlideView';
import { ConnectPairsView } from './slides/ConnectPairsView';
import { FillBlanksView } from './slides/FillBlanksView';
import { ImageHotspotsView } from './slides/ImageHotspotsView';
import { VideoQuizView } from './slides/VideoQuizView';
import Lottie from 'lottie-react';
import { QRCodeSVG } from 'qrcode.react';
import { checkMathAnswer } from '../../utils/math-compare';
import { getContrastColor } from '../../utils/color-utils';
import { MathKeyboard } from '../math/MathKeyboard';
import { addBoardComment, getSlideComments, BoardComment } from '../../utils/supabase/board-comments';

/**
 * Lottie Block Preview - for viewing lottie animations in slides
 */
function LottieBlockPreview({ 
  url, 
  loop = true, 
  autoplay = true 
}: { 
  url: string; 
  loop?: boolean; 
  autoplay?: boolean;
}) {
  const [animationData, setAnimationData] = React.useState<any>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!url) return;
    
    fetch(url)
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(() => setError(true));
  }, [url]);

  if (error || !animationData) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400">
        {error ? 'Chyba načítání animace' : 'Načítání...'}
      </div>
    );
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop !== false}
      autoplay={autoplay !== false}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

const NoteIcon = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size * (13/6)} 
    viewBox="0 0 6 13" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ height: size }}
  >
    <g clipPath="url(#clip0_note_icon_preview)">
      <path d="M1.91903 5.57928C1.91903 5.19451 1.80615 5.06625 1.5965 5.05021C1.43524 5.05021 1.27398 5.08228 1.11272 5.21054C0.886947 5.40293 0.677305 5.70754 0.661179 5.89993C0.645052 6.09232 0.661179 6.34884 0.596673 6.50916C0.532168 6.62139 0.43541 6.63742 0.354779 6.63742C0.12901 6.62139 0 6.46107 0 6.18852C0 5.06625 0.935326 4.29669 1.8384 3.96001C2.25768 3.79969 2.69309 3.71952 2.96724 3.71952C3.41878 3.71952 3.77356 4.18446 3.77356 4.66544C3.77356 5.17847 3.6768 5.46706 3.30589 7.87192C3.14463 8.898 2.93499 10.0042 2.93499 10.5814C2.93499 10.9501 3.08012 11.1746 3.48328 11.1746C4.01545 11.1746 4.40248 10.3409 4.43473 9.9882C4.46699 9.73168 4.56374 9.58739 4.74113 9.58739C4.93465 9.58739 5.14429 9.76375 5.14429 10.0042C5.14429 10.405 4.88627 11.2227 4.07996 11.848C3.69292 12.1526 3.17688 12.4251 2.54796 12.4251C1.64488 12.4251 1.08046 11.8159 1.08046 11.0143C1.08046 10.2768 1.19335 9.57136 1.532 8.00018C1.79002 6.84585 1.9029 6.02819 1.9029 5.61135L1.91903 5.57928ZM3.30589 0C3.91869 0 4.30572 0.368746 4.30572 0.945913C4.30572 1.65134 3.61229 2.18041 2.88661 2.18041C2.24156 2.18041 1.85453 1.79563 1.85453 1.25053C1.85453 0.480973 2.61246 0 3.28977 0L3.30589 0Z" fill="currentColor"/>
    </g>
    <defs>
      <clipPath id="clip0_note_icon_preview">
        <rect width="5.12817" height="12.3931" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

interface QuizPreviewProps {
  quiz: Quiz;
  onClose?: () => void;
  isLive?: boolean;
  onComplete?: (responses: SlideResponse[]) => void;
  initialSlideIndex?: number;
  // Public mode for commenting
  isPublicMode?: boolean;
  boardId?: string;
}

// ============================================
// SLIDE RENDERERS - Same as QuizViewPage
// ============================================

function ABCSlideView({ 
  slide, 
  showSolution, 
  selectedAnswer, 
  onSelectAnswer 
}: { 
  slide: ABCActivitySlide;
  showSolution: boolean;
  selectedAnswer?: string;
  onSelectAnswer?: (id: string) => void;
}) {
  const hasImage = !!slide.media?.url;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  const answerType = (slide as any).answerType;
  const isSquareMode = answerType === 'image' || answerType === 'emoji';
  const optionCount = slide.options.length;
  
  // Dynamic size based on option count: 2 options = large, 4+ = smaller
  // Increased by 20% for better visibility
  const getSquareSize = () => {
    if (isMobile) return optionCount <= 2 ? '168px' : '120px';
    if (optionCount <= 2) return '240px';
    if (optionCount <= 3) return '192px';
    return '168px';
  };
  
  // Render option button
  const renderOption = (option: any) => {
    const isSelected = selectedAnswer === option.id;
    const isCorrect = showSolution && option.isCorrect;
    const isWrong = showSolution && isSelected && !option.isCorrect;
    
    return (
      <button
        key={option.id}
        onClick={() => onSelectAnswer?.(option.id)}
        disabled={showSolution}
        className={`
          relative p-3 md:p-4 rounded-2xl text-left transition-all border-2 
          ${isSquareMode ? 'flex flex-col items-center justify-center' : 'flex items-center gap-3 md:gap-4'}
          ${isCorrect ? 'bg-green-50 border-green-500' : ''}
          ${isWrong ? 'bg-red-50 border-red-500' : ''}
          ${!showSolution && isSelected ? 'border-indigo-500 bg-indigo-50' : ''}
          ${!showSolution && !isSelected ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md' : ''}
          ${!isCorrect && !isWrong && !isSelected && showSolution ? 'bg-white border-slate-100 opacity-50' : ''}
        `}
        style={isSquareMode ? { width: getSquareSize(), height: getSquareSize() } : {}}
      >
        {/* Label */}
        <span 
          style={{
            width: isMobile ? '28px' : '36px',
            height: isMobile ? '28px' : '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: isMobile ? '12px' : '14px',
            flexShrink: 0,
            transition: 'all 0.2s',
            backgroundColor: isCorrect ? '#bbf7d0' : isWrong ? '#fecaca' : (!showSolution && isSelected) ? '#c7d2fe' : '#cbd5e1',
            color: isCorrect ? '#166534' : isWrong ? '#991b1b' : (!showSolution && isSelected) ? '#3730a3' : '#475569',
            position: isSquareMode ? 'absolute' : 'relative',
            top: isSquareMode ? '6px' : 'auto',
            left: isSquareMode ? '6px' : 'auto',
          }}
        >
          {option.label || option.id?.toUpperCase() || '?'}
        </span>
        
        {/* Content based on answer type - strictly separated */}
        {answerType === 'image' ? (
          // IMAGE MODE - show image or placeholder
          option.imageUrl ? (
            <img 
              src={option.imageUrl} 
              alt={option.label}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <span className="text-4xl">🖼️</span>
            </div>
          )
        ) : answerType === 'emoji' ? (
          // EMOJI MODE - show emoji only
          <span 
            className="text-center"
            style={{ 
              fontSize: isMobile ? '40px' : optionCount <= 2 ? '72px' : '56px',
              fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif' 
            }}
          >
            {option.emojiContent || '😊'}
          </span>
        ) : (
          // TEXT MODE - show text only
          <span className="text-base md:text-xl font-medium text-[#4E5871] flex-1">
            <MathText>{option.textContent || option.content || ''}</MathText>
          </span>
        )}
        
        {/* Correct/Wrong indicators */}
        {isCorrect && (
          <CheckCircle className={`w-5 h-5 md:w-6 md:h-6 text-green-600 ${isSquareMode ? 'absolute bottom-2 right-2' : ''}`} />
        )}
        {isWrong && (
          <XCircle className={`w-5 h-5 md:w-6 md:h-6 text-red-500 ${isSquareMode ? 'absolute bottom-2 right-2' : ''}`} />
        )}
      </button>
    );
  };

  // Mobile layout - always vertical
  if (isMobile) {
    return (
      <div className="flex flex-col h-full p-4 overflow-auto">
        {/* Question - more space around it */}
        <div className="flex-1 flex items-center justify-center py-6 px-2">
          <h1 className="text-2xl font-bold leading-relaxed text-center" style={{ color: 'inherit' }}>
            <MathText>{slide.question || ''}</MathText>
          </h1>
        </div>
        
        {/* Image if present */}
        {hasImage && (
          <div className="flex justify-center py-4">
            <img 
              src={slide.media!.url} 
              alt="Obrázek k otázce"
              className="max-w-full max-h-40 object-contain rounded-xl shadow-lg"
            />
          </div>
        )}
        
        {/* Options - mobile: vertical for text, 2x2 for image/emoji */}
        <div className={isSquareMode ? 'grid grid-cols-2 gap-2 pb-4' : 'flex flex-col gap-2 pb-4'}>
          {slide.options.map(renderOption)}
        </div>
        
        {/* Explanation */}
        {showSolution && slide.explanation && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-4">
            <p className="text-sm text-blue-800"><MathText>{slide.explanation}</MathText></p>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout WITH image: Left side (question + image) | Right side (options)
  if (hasImage) {
    return (
      <div className="flex h-full p-6 gap-6">
        {/* Left side - Question and Image */}
        <div className="flex-1 flex flex-col">
          {/* Question - 50% height */}
          <div className="flex items-center justify-center p-4" style={{ height: '50%' }}>
            <h1 className="text-3xl md:text-4xl font-bold text-center leading-tight" style={{ color: 'inherit' }}>
              <MathText>{slide.question || ''}</MathText>
            </h1>
          </div>
          
          {/* Image - 50% height */}
          <div className="flex items-center justify-center" style={{ height: '50%' }}>
            <img 
              src={slide.media!.url} 
              alt="Obrázek k otázce"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-lg"
            />
          </div>
        </div>
        
        {/* Right side - Options */}
        <div className={isSquareMode 
          ? 'flex-shrink-0 flex flex-wrap gap-3 justify-center items-center' 
          : 'w-80 flex-shrink-0 flex flex-col gap-3 justify-center'
        }>
          {slide.options.map(renderOption)}
        </div>
        
        {/* Explanation */}
        {showSolution && slide.explanation && (
          <div className="absolute bottom-4 left-6 right-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-blue-800"><MathText>{slide.explanation}</MathText></p>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout WITHOUT image: Question on top (70%), Options below (30%)
  return (
    <div className="flex flex-col h-full">
      {/* Question - takes 65% of height for maximum visibility on projector */}
      <div className="flex items-center justify-center p-6" style={{ height: '65%' }}>
        <AutoScaleQuestion targetFill={0.85} maxFontSize={150}>{slide.question || ''}</AutoScaleQuestion>
      </div>
      
      {/* Options - row for image/emoji on desktop, 2x2 for text */}
      <div className="flex-1 flex items-end pb-6">
        <div className={isSquareMode 
          ? 'flex gap-4 px-6 justify-center mx-auto' 
          : 'grid grid-cols-2 gap-4 px-6 max-w-4xl mx-auto w-full'
        }>
          {slide.options.map(renderOption)}
        </div>
      </div>
      
      {/* Explanation */}
      {showSolution && slide.explanation && (
        <div className="mx-6 mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-blue-800"><MathText>{slide.explanation}</MathText></p>
        </div>
      )}
    </div>
  );
}

function OpenSlideView({ 
  slide, 
  textAnswer, 
  setTextAnswer,
  showResult,
  response,
  onSubmit
}: { 
  slide: OpenActivitySlide;
  textAnswer: string;
  setTextAnswer: (text: string) => void;
  showResult: boolean;
  response?: SlideResponse;
  onSubmit?: () => void;
}) {
  return (
    <div className="flex flex-col h-full items-center justify-center p-8">
      <h1 
        className="text-4xl md:text-5xl font-bold text-center leading-tight mb-8"
        style={{ overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none', color: 'inherit' }}
      >
        <MathText>{slide.question || 'Otevřená otázka...'}</MathText>
      </h1>
      <div className="w-full max-w-2xl">
        <input
          type="text"
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
          disabled={showResult}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && textAnswer.trim() && onSubmit) {
              onSubmit();
            }
          }}
          className={`
            w-full px-6 py-4 text-xl text-center rounded-2xl border-2 outline-none transition-all
            ${showResult 
              ? response?.isCorrect 
                ? 'bg-green-50 border-green-500' 
                : 'bg-red-50 border-red-500'
              : 'border-slate-200 focus:border-indigo-400'
            }
          `}
          placeholder="Napište svou odpověď..."
        />
        
        {/* Result */}
        {showResult && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {response?.isCorrect ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="font-medium text-green-600">Správně!</span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-500" />
                <span className="font-medium text-red-600">
                  Správná odpověď: {slide.correctAnswers[0]}
                </span>
              </>
            )}
          </div>
        )}
        
        {/* Explanation */}
        {showResult && slide.explanation && (
          <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-blue-800"><MathText>{slide.explanation}</MathText></p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExampleSlideView({ 
  slide,
  textAnswer,
  setTextAnswer,
  showResult,
  response,
  onSubmit,
  onOpenMathPanel
}: { 
  slide: ExampleActivitySlide;
  textAnswer: string;
  setTextAnswer: (text: string) => void;
  showResult: boolean;
  response?: SlideResponse;
  onSubmit?: () => void;
  onOpenMathPanel?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div className="flex flex-col h-full items-center justify-center p-8">
      {/* Problem with auto-scaling */}
      <h1 
        className="text-4xl md:text-5xl font-bold text-center leading-tight mb-8"
        style={{ overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none', color: 'inherit' }}
      >
        <MathText>{slide.problem || 'Zadání...'}</MathText>
      </h1>
      
      {/* Answer input */}
      <div className="w-full max-w-2xl">
        <div 
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Math keyboard icon - shown on hover */}
              <button
            onClick={onOpenMathPanel}
            className={`
              absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all z-10
              ${isHovered && !showResult ? 'opacity-100' : 'opacity-0'}
              hover:bg-indigo-100 text-indigo-600
            `}
            title="Otevřít matematickou klávesnici"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
              <path d="M9 7h6"/>
              <path d="M12 7v10"/>
              <path d="M7 11h10"/>
            </svg>
              </button>
          
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={showResult}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && textAnswer.trim() && onSubmit) {
                onSubmit();
              }
            }}
            className={`
              w-full px-6 py-4 text-xl text-center rounded-2xl border-2 outline-none transition-all
              ${showResult 
                ? response?.isCorrect 
                  ? 'bg-green-50 border-green-500' 
                  : 'bg-red-50 border-red-500'
                : 'border-slate-200 focus:border-indigo-400 hover:border-indigo-300'
              }
            `}
            placeholder="Vaše odpověď"
          />
              </div>
        
        {/* Result */}
        {showResult && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {response?.isCorrect ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="font-medium text-green-600">Správně!</span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-500" />
                <span className="font-medium text-red-600">
                  Správná odpověď: <MathText>{slide.finalAnswer || ''}</MathText>
                </span>
              </>
            )}
        </div>
      )}
      </div>
    </div>
  );
}

function InfoSlideView({ slide }: { slide: InfoSlide }) {
  // If slide has new block-based layout, render it
  if (slide.layout && slide.layout.blocks.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
        <BlockLayoutView slide={slide} />
      </div>
    );
  }

  // Fallback to legacy format
  return (
    <div className="flex flex-col flex-1 h-full p-8">
      {slide.title && (
        <h1 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: 'inherit' }}>
          <MathText>{slide.title}</MathText>
        </h1>
      )}
      <div 
        className="prose prose-lg max-w-none flex-1"
        dangerouslySetInnerHTML={{ __html: slide.content }}
      />
      {slide.media && slide.media.type === 'image' && (
        <img 
          src={slide.media.url} 
          alt={slide.media.caption || ''} 
          className="mt-6 rounded-xl max-w-full mx-auto"
        />
      )}
      {slide.media && slide.media.type === 'lottie' && (
        <div className="mt-6 w-full max-w-md mx-auto aspect-square">
          <LottieBlockPreview url={slide.media.url} loop={true} autoplay={true} />
        </div>
      )}
    </div>
  );
}

// Image block with gallery support for preview
function ImageBlockPreview({ block, borderRadius }: { block: any; borderRadius: number }) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);

  const hasGallery = block.gallery && block.gallery.length > 1;
  const imageScale = block.imageScale || 100;
  // If scale > 100%, use cover mode (crop), otherwise contain
  const imageFit = imageScale > 100 ? 'cover' : (block.imageFit || 'contain');
  const navType = block.galleryNavType || 'dots-bottom';
  
  // Image position for object-position (0-100, default 50 = center)
  const posX = block.imagePositionX ?? 50;
  const posY = block.imagePositionY ?? 50;

  // Get current image
  const currentImage = hasGallery
    ? (navType === 'solution' ? (showSolution ? block.gallery[1] : block.gallery[0]) : block.gallery[galleryIndex])
    : block.content;

  const goNext = () => {
    if (hasGallery) {
      setGalleryIndex((prev) => (prev + 1) % block.gallery.length);
    }
  };

  const goPrev = () => {
    if (hasGallery) {
      setGalleryIndex((prev) => (prev - 1 + block.gallery.length) % block.gallery.length);
    }
  };

  if (!currentImage) return null;

  const renderNavigation = () => {
    if (!hasGallery) return null;

    switch (navType) {
      case 'dots-bottom':
        return (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 px-3 py-2 rounded-full">
            {block.gallery.map((_: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setGalleryIndex(idx)}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === galleryIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        );

      case 'dots-side':
        return (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-black/30 px-2 py-3 rounded-full">
            {block.gallery.map((_: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setGalleryIndex(idx)}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === galleryIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        );

      case 'arrows':
        return (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full shadow-lg"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full shadow-lg"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        );

      case 'solution':
        return (
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 shadow-lg z-30"
            style={{
              backgroundColor: showSolution ? '#334155' : '#4f46e5',
              color: 'white',
            }}
          >
            {showSolution ? 'Skrýt řešení' : 'Zobrazit řešení'}
          </button>
        );

      default:
        return null;
    }
  };

  const imageContent = (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ borderRadius }}>
      {imageFit === 'cover' ? (
        <img
          src={currentImage}
          alt={block.imageCaption || ''}
          className="w-full h-full"
          style={{
            objectFit: 'cover',
            objectPosition: `${posX}% ${posY}%`,
            transform: imageScale > 100 ? `scale(${imageScale / 100})` : undefined,
          }}
        />
      ) : (
        <img
          src={currentImage}
          alt={block.imageCaption || ''}
          className="transition-transform max-w-full max-h-full"
          style={{
            width: `${imageScale}%`,
            height: 'auto',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: Math.max(0, borderRadius - 4),
          }}
        />
      )}
      {renderNavigation()}
      {block.imageCaption && (
        <div className={`absolute ${hasGallery ? 'bottom-14' : 'bottom-0'} left-0 right-0 bg-black/50 text-white text-sm px-3 py-2 text-center`}>
          {block.imageCaption}
        </div>
      )}
    </div>
  );

  if (block.imageLink) {
    return (
      <a href={block.imageLink} target="_blank" rel="noopener noreferrer" className="h-full w-full block">
        {imageContent}
      </a>
    );
  }

  return imageContent;
}

// Block-based layout renderer for new info slides
export function BlockLayoutView({ slide }: { slide: InfoSlide }) {
  const layout = slide.layout!;
  const blocks = layout.blocks;
  const titleHeight = layout.titleHeight || 15;
  const columnRatios = layout.columnRatios || [50, 50];
  const splitRatio = layout.splitRatio || 50;

  // Detect mobile screen
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get template settings
  const template = slide.templateId ? getTemplateById(slide.templateId) : undefined;
  const blockGap = slide.blockGap ?? template?.defaultGap ?? 11;
  const blockRadius = slide.blockRadius ?? template?.defaultRadius ?? 8;
  const blockColors = template?.blockColors || [];
  const fontFamily = template?.font ? (template.font.includes(' ') ? `"${template.font}", sans-serif` : `${template.font}, sans-serif`) : 'inherit';

  // Get background style for slide
  const getSlideBackgroundStyle = (): React.CSSProperties => {
    if (!slide.slideBackground) return {};
    const bg = slide.slideBackground;
    if (bg.type === 'color' && bg.color) {
      return { backgroundColor: bg.color === 'transparent' ? 'transparent' : bg.color };
    }
    if (bg.type === 'image' && bg.imageUrl) {
      return {
        backgroundImage: `url(${bg.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return {};
  };

  // Render a single block with template styling
  const renderBlock = (block: typeof blocks[0], blockIndex: number) => {
    const bgStyle: React.CSSProperties = {
      borderRadius: blockRadius,
    };
    
    // Use block background if set, otherwise template color
    if (block.background?.type === 'color' && block.background.color) {
      bgStyle.backgroundColor = block.background.color === 'transparent' ? 'transparent' : block.background.color;
    } else if (blockColors[blockIndex % blockColors.length]) {
      bgStyle.backgroundColor = blockColors[blockIndex % blockColors.length];
    }

    const textAlignClass = block.textAlign === 'center' ? 'text-center' : block.textAlign === 'right' ? 'text-right' : 'text-left';
    const verticalAlignClass = block.verticalAlign === 'middle' ? 'justify-center' : block.verticalAlign === 'bottom' ? 'justify-end' : 'justify-start';
    // Use cqw (container query width) for consistent sizing relative to container
    const fontSize = block.fontSize === 'xxlarge' ? 'clamp(64px, 9cqw, 120px)' :
                     block.fontSize === 'xlarge' ? 'clamp(48px, 6.5cqw, 80px)' : 
                     block.fontSize === 'large' ? 'clamp(32px, 4.5cqw, 54px)' : 
                     block.fontSize === 'small' ? 'clamp(16px, 2.2cqw, 24px)' :
                     block.fontSize === 'xsmall' ? 'clamp(12px, 1.5cqw, 16px)' : 'clamp(22px, 3cqw, 36px)';
    
    const blockFontFamilyMap: Record<string, string> = {
      fenomen: '"Fenomen Sans", ui-sans-serif, system-ui, sans-serif',
      cooper: '"Cooper Light", serif',
      space: '"Space Grotesk", sans-serif',
      sora: '"Sora", sans-serif',
      playfair: '"Playfair Display", serif',
      itim: '"Itim", cursive',
      sacramento: '"Sacramento", cursive',
      lora: '"Lora", serif',
      oswald: '"Oswald", sans-serif',
    };
    // Get the font family - use block's fontFamily if set, otherwise default to fenomen
    const actualFontFamily = block.fontFamily && blockFontFamilyMap[block.fontFamily] 
      ? blockFontFamilyMap[block.fontFamily] 
      : blockFontFamilyMap.fenomen;
    
    const fontWeightClass = block.fontWeight === 'bold' ? 'font-bold' : 'font-normal';
    const fontStyleClass = block.fontStyle === 'italic' ? 'italic' : '';
    const textDecorationClass = block.textDecoration === 'underline' ? 'underline' : '';

    const isValidMediaUrl = (url?: string) => {
      if (!url) return false;
      return url.startsWith('http') || url.startsWith('data:image/') || url.startsWith('data:application/json');
    };

    if (block.type === 'image' && (isValidMediaUrl(block.content) || (block.gallery && block.gallery.length > 0))) {
      return (
        <div className="h-full w-full overflow-hidden relative" style={bgStyle}>
          <ImageBlockPreview block={block} borderRadius={Math.max(0, blockRadius - 4)} />
        </div>
      );
    }

    if (block.type === 'lottie' && isValidMediaUrl(block.lottieUrl || block.content)) {
      return (
        <div className="h-full w-full overflow-hidden relative" style={bgStyle}>
          <LottieBlockPreview url={block.lottieUrl || block.content} loop={block.lottieLoop} autoplay={block.lottieAutoplay} />
        </div>
      );
    }

    if (block.type === 'link' && isValidMediaUrl(block.content)) {
      const mode = block.linkMode || 'button';
      const url = block.content;

      // Wrap video/embed/preview in a relative container to ensure absolute children stay within bounds
      const RelativeWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
        <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ ...bgStyle, borderRadius: blockRadius }}>
          {children}
        </div>
      );

      switch (mode) {
        case 'qr':
          return (
            <div className="h-full w-full flex items-center justify-center p-4" style={bgStyle}>
              <div 
                className="w-full h-full max-w-full max-h-full flex items-center justify-center bg-white shadow-sm border border-slate-100 p-4 overflow-hidden"
                style={{ borderRadius: blockRadius }}
              >
                <QRCodeSVG 
                  value={url} 
                  size={1000}
                  style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
                  level="H" 
                  includeMargin={true} 
                />
              </div>
            </div>
          );

        case 'video':
          const getYoutubeId = (url: string) => {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
          };
          const videoId = getYoutubeId(url);
          if (videoId) {
            return (
              <RelativeWrapper className="bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`}
                  className="absolute inset-0 w-full h-full border-none"
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </RelativeWrapper>
            );
          }
          break;

        case 'embed':
          // Convert http:// to https:// to avoid mixed content errors on HTTPS pages
          const secureUrl = url.startsWith('http://') ? url.replace('http://', 'https://') : url;
          return (
            <RelativeWrapper className="bg-slate-50">
              <iframe
                src={secureUrl}
                className="absolute inset-0 w-full h-full border-none"
                title="Embedded content"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </RelativeWrapper>
          );

        case 'preview':
          return (
            <RelativeWrapper className="bg-white">
              <div 
                className="h-full w-full flex flex-col cursor-pointer group shadow-sm hover:shadow-md transition-shadow" 
                onClick={() => window.open(url, '_blank')}
              >
                {block.linkThumbnail ? (
                  <div className="flex-1 min-h-0 bg-slate-100 overflow-hidden">
                    <img src={block.linkThumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-50">
                    <Globe className="w-12 h-12 text-slate-200" />
                  </div>
                )}
                <div className="p-4 flex flex-col gap-1 shrink-0">
                  <h4 className="font-bold text-slate-800 truncate line-clamp-1">
                    {block.linkTitle || 'Náhled odkazu'}
                  </h4>
                  {block.linkDescription && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {block.linkDescription}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-blue-600 font-medium text-[10px] uppercase tracking-wider">
                    <ExternalLink className="w-3 h-3" />
                    <span>Otevřít stránku</span>
                  </div>
                </div>
              </div>
            </RelativeWrapper>
          );

        case 'button':
        default:
      return (
        <div className="h-full flex items-center justify-center p-4" style={bgStyle}>
              <button
                onClick={() => window.open(url, '_blank')}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all hover:scale-105 active:scale-95 text-white"
                style={{
                  backgroundColor: slide.templateId ? getTemplateById(slide.templateId)?.colors.primary : '#4f46e5',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center transition-colors group-hover:bg-white/30">
                  <ExternalLink className="w-6 h-6" />
                </div>
                <span className="text-lg font-bold tracking-tight">
                  {block.linkTitle || 'Přejít na odkaz'}
                </span>
              </button>
        </div>
      );
      }
    }

    // Text block
    const textStyle: React.CSSProperties = {
      fontSize,
      fontFamily: actualFontFamily,
      color: block.textColor || '#1e293b',
    };
    
    // Background: use highlight if set, otherwise block background
    const blockBgColor = block.highlightColor && block.highlightColor !== 'transparent' 
      ? block.highlightColor 
      : bgStyle.backgroundColor;
    
    // For 'fit' mode, calculate font size based on container (desktop only)
    const TextContent = ({ theFontFamily }: { theFontFamily: string }) => {
      const containerRef = React.useRef<HTMLDivElement>(null);
      const [fitFontSize, setFitFontSize] = React.useState<number | null>(null);

      const calculateFitSize = React.useCallback(() => {
        // On mobile, don't calculate - use large readable sizes
        if (isMobile) return;
        
        // Default to 'fit' if not explicitly set to 'scroll'
        const isFitMode = block.textOverflow === 'fit' || block.textOverflow === undefined;
        if (!isFitMode || !containerRef.current || !block.content) return;
        
        const container = containerRef.current;
        // Use dynamic textPadding (default 20px on each side)
        const padding = (block.textPadding ?? 20) * 2;
        const targetHeight = (container.clientHeight - padding) * 0.9; // 90% of available height (matching editor)
        const containerWidth = container.clientWidth - padding;

        if (targetHeight <= 0 || containerWidth <= 0) return;

        // Can go up to 200px for short text in large blocks
        let minSize = 8;
        let maxSize = 200;
        
        const measureEl = document.createElement('div');
        measureEl.style.cssText = `
          position: absolute;
          visibility: hidden;
          white-space: pre-wrap;
          overflow-wrap: normal;
          word-break: normal;
          hyphens: none;
          width: ${containerWidth}px;
          font-family: ${theFontFamily};
          font-weight: ${block.fontWeight === 'bold' ? 'bold' : 'normal'};
          font-style: ${block.fontStyle === 'italic' ? 'italic' : 'normal'};
          line-height: ${block.lineHeight ?? 1.5};
          letter-spacing: ${block.letterSpacing ?? 0}px;
          box-sizing: border-box;
        `;
        measureEl.textContent = block.content;
        document.body.appendChild(measureEl);

        let optimalSize = minSize;
        while (minSize <= maxSize) {
          const midSize = Math.floor((minSize + maxSize) / 2);
          measureEl.style.fontSize = `${midSize}px`;
          
          // Check both height AND width (for single words that might be too wide)
          const fitsHeight = measureEl.scrollHeight <= targetHeight;
          const fitsWidth = measureEl.scrollWidth <= containerWidth;
          
          if (fitsHeight && fitsWidth) {
            optimalSize = midSize;
            minSize = midSize + 1;
          } else {
            maxSize = midSize - 1;
          }
        }

        document.body.removeChild(measureEl);
        setFitFontSize(optimalSize);
      }, [isMobile, theFontFamily, block.textPadding, block.lineHeight, block.letterSpacing]);

      // Initial calculation and recalculate when typography settings change
      React.useEffect(() => {
        calculateFitSize();
      }, [calculateFitSize, block.textPadding, block.lineHeight, block.letterSpacing]);

      // ResizeObserver for real-time updates (desktop only)
      React.useEffect(() => {
        if (isMobile) return;
        const isFitMode = block.textOverflow === 'fit' || block.textOverflow === undefined;
        if (!isFitMode || !containerRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
          calculateFitSize();
        });

        resizeObserver.observe(containerRef.current);

        return () => {
          resizeObserver.disconnect();
        };
      }, [calculateFitSize, isMobile, block.textPadding]);

      // On mobile: use large readable font sizes for 'fit' mode
      // On desktop: use fit calculation or scroll based on setting
      const isFitMode = block.textOverflow === 'fit' || block.textOverflow === undefined;
      const hasScroll = isMobile || block.textOverflow === 'scroll';
      
      // Mobile font sizes - LARGE and readable for 'fit' mode (auto)
      // These scale based on content length for better readability
      const contentLength = block.content?.length || 0;
      const getMobileFitSize = () => {
        if (contentLength < 20) return '72px';  // Very short text - huge
        if (contentLength < 50) return '56px';  // Short text - large
        if (contentLength < 100) return '42px'; // Medium text
        if (contentLength < 200) return '32px'; // Longer text
        return '24px'; // Long text
      };
      
      const mobileFontSize = isFitMode 
        ? getMobileFitSize()
        : (block.fontSize === 'xxlarge' ? '64px' :
           block.fontSize === 'xlarge' ? '48px' : 
           block.fontSize === 'large' ? '32px' : 
           block.fontSize === 'small' ? '16px' :
           block.fontSize === 'xsmall' ? '12px' : '24px');
      
      const finalFontSize = isMobile 
        ? mobileFontSize 
        : (isFitMode && fitFontSize ? `${fitFontSize}px` : textStyle.fontSize);
      
      return (
        <div 
          ref={containerRef}
          className={`w-full flex flex-col ${textAlignClass} ${verticalAlignClass} ${fontWeightClass} ${fontStyleClass} ${textDecorationClass}`} 
          style={{
            ...bgStyle,
            backgroundColor: blockBgColor,
            fontSize: finalFontSize,
            color: textStyle.color,
            fontFamily: theFontFamily,
            whiteSpace: 'pre-wrap',
            // On mobile: allow word breaking to prevent overflow
            wordWrap: isMobile ? 'break-word' : 'normal',
            overflowWrap: isMobile ? 'break-word' : 'normal',
            wordBreak: isMobile ? 'break-word' : 'normal',
            hyphens: isMobile ? 'auto' : 'none',
            lineHeight: block.lineHeight ?? 1.5,
            letterSpacing: `${block.letterSpacing ?? 0}px`,
            // On mobile: cap padding at 16px to prevent text overflow
            padding: isMobile 
              ? `${Math.min(block.textPadding ?? 20, 16)}px` 
              : `${block.textPadding ?? 20}px`,
            // On mobile: flex-grow to fill parent (for vertical alignment)
            // On desktop: fixed height with scroll or fit
            height: isMobile ? '100%' : '100%',
            flex: isMobile ? 1 : undefined,
            minHeight: isMobile ? 'auto' : undefined,
            overflowY: isMobile ? 'visible' : (hasScroll ? 'auto' : 'hidden'),
            overflowX: 'hidden',
            // Always show scrollbar when scrollable
            scrollbarWidth: hasScroll && !isMobile ? 'thin' : undefined,
            scrollbarColor: hasScroll && !isMobile ? '#cbd5e1 transparent' : undefined,
          }}
        >
          <MathText style={{ fontFamily: theFontFamily }}>{block.content}</MathText>
        </div>
      );
    };

    return <TextContent theFontFamily={actualFontFamily} key={`text-${blockIndex}-${block.fontFamily || 'fenomen'}`} />;
  };

  // DESKTOP LAYOUT - exact proportions from editor
  const renderDesktopLayout = () => {
    const gapStyle = { gap: blockGap };
    const halfGap = blockGap / 2;
    const twoThirdsGap = blockGap * 2 / 3;
    
    switch (layout.type) {
      case 'single':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0 }}>{renderBlock(blocks[0], 0)}</div>
          </div>
        );

      case 'title-content':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${titleHeight}% - ${halfGap}px)`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: 1, minHeight: 0 }}>{renderBlock(blocks[1], 1)}</div>
          </div>
        );

      case 'title-2cols':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${titleHeight}% - ${halfGap}px)`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, ...gapStyle }}>
              <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${halfGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[2], 2)}</div>
            </div>
          </div>
        );

      case 'title-3cols':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${titleHeight}% - ${halfGap}px)`, minHeight: 60 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, ...gapStyle }}>
              <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${twoThirdsGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ flex: `0 0 calc(${columnRatios[1]}% - ${twoThirdsGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[2], 2)}</div>
              <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[3], 3)}</div>
            </div>
          </div>
        );

      case '2cols':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'row', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${halfGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[1], 1)}</div>
          </div>
        );

      case '3cols':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'row', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${twoThirdsGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: `0 0 calc(${columnRatios[1]}% - ${twoThirdsGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[1], 1)}</div>
            <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[2], 2)}</div>
          </div>
        );

      case 'left-large-right-split':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'row', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${halfGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[0], 0)}</div>
            <div style={{ flex: `0 0 calc(${columnRatios[1]}% - ${halfGap}px)`, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, ...gapStyle }}>
              <div style={{ flex: `0 0 calc(${splitRatio}% - ${halfGap}px)`, minHeight: 0 }}>{renderBlock(blocks[1], 1)}</div>
              <div style={{ flex: 1, minHeight: 0 }}>{renderBlock(blocks[2], 2)}</div>
            </div>
          </div>
        );

      case 'right-large-left-split':
        return (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'row', ...gapStyle }}>
            <div style={{ flex: `0 0 calc(${columnRatios[0]}% - ${halfGap}px)`, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, ...gapStyle }}>
              <div style={{ flex: `0 0 calc(${splitRatio}% - ${halfGap}px)`, minHeight: 0 }}>{renderBlock(blocks[0], 0)}</div>
              <div style={{ flex: 1, minHeight: 0 }}>{renderBlock(blocks[1], 1)}</div>
            </div>
            <div style={{ flex: `0 0 calc(${columnRatios[1]}% - ${halfGap}px)`, minHeight: 0, minWidth: 0 }}>{renderBlock(blocks[2], 2)}</div>
          </div>
        );

      default:
        return null;
    }
  };

  // MOBILE LAYOUT - simple vertical stack, scrollable
  // Special case: single block with image should be vertically centered
  const renderMobileLayout = () => {
    // Check if this is a single block with an image - if so, center it vertically
    const isSingleImageBlock = blocks.length === 1 && (blocks[0].type === 'image' || blocks[0].type === 'lottie');
    
    if (isSingleImageBlock) {
      const block = blocks[0];
      const imageScale = block.imageScale || 100;
      const imageFit = imageScale > 100 ? 'cover' : (block.imageFit || 'contain');
      const posX = block.imagePositionX ?? 50;
      const posY = block.imagePositionY ?? 50;
      const hasGallery = block.gallery && block.gallery.length > 1;
      const currentImage = (hasGallery && block.gallery) ? block.gallery[0] : block.content;
      
      // Full height centered layout for single image/lottie - minimal padding for max image size
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          padding: 8, // Minimal padding for largest possible image
        }}>
          {block.type === 'image' ? (
            <img
              src={currentImage}
              alt={block.imageCaption || ''}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 200px)',
                objectFit: imageFit as any,
                objectPosition: imageFit === 'cover' ? `${posX}% ${posY}%` : undefined,
                borderRadius: blockRadius,
              }}
            />
          ) : (
            <div style={{ 
              width: '100%', 
              maxWidth: '400px',
              aspectRatio: '1',
            }}>
              <LottieBlockPreview 
                url={block.lottieUrl || block.content} 
                loop={block.lottieLoop} 
                autoplay={block.lottieAutoplay} 
              />
            </div>
          )}
          {block.imageCaption && (
            <div className="mt-3 text-center text-sm text-slate-600 px-4">
              {block.imageCaption}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: blockGap }}>
        {blocks.map((block, index) => {
          // For text blocks with vertical alignment, use minHeight to allow alignment to work
          const hasVerticalAlign = block.type === 'text' && block.verticalAlign && block.verticalAlign !== 'top';
          const textMinHeight = hasVerticalAlign ? 300 : 60;
          
          // For link blocks with embed/video/preview mode, need explicit height for iframe
          // Use most of viewport height for better mobile experience
          const isEmbedLink = block.type === 'link' && ['embed', 'video', 'preview'].includes(block.linkMode || '');
          const linkHeight = isEmbedLink ? 'calc(100vh - 120px)' : 'auto';
          
          // Determine block height
          let blockHeight: number | string = 'auto';
          if (block.type === 'image' || block.type === 'lottie') {
            blockHeight = 250;
          } else if (isEmbedLink) {
            blockHeight = linkHeight;
          }
          
          return (
            <div 
              key={index} 
              style={{ 
                height: blockHeight,
                minHeight: block.type === 'text' ? textMinHeight : undefined,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {renderBlock(block, index)}
            </div>
          );
        })}
      </div>
    );
  };

  // Desktop: full height with aspect ratio, Mobile: auto height scrollable
  if (isMobile) {
    // Check if this is a single block with an image - if so, we need full height for centering
    const isSingleImageBlock = blocks.length === 1 && (blocks[0].type === 'image' || blocks[0].type === 'lottie');
    
    if (isSingleImageBlock) {
      // For single image blocks, use flex to fill entire available space
      return (
        <div 
          style={{ 
            ...getSlideBackgroundStyle(), 
            fontFamily,
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: '100%',
          }}
        >
          {renderMobileLayout()}
        </div>
      );
    }
    
    return (
      <div 
        style={{ 
          ...getSlideBackgroundStyle(), 
          padding: blockGap > 0 ? blockGap : 0,
          fontFamily,
        }}
      >
        {renderMobileLayout()}
      </div>
    );
  }

  return (
    <div 
      style={{ 
        ...getSlideBackgroundStyle(), 
        padding: blockGap > 0 ? blockGap : 0,
        fontFamily,
        containerType: 'inline-size',
        height: '100%',
      }}
    >
      {renderDesktopLayout()}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function QuizPreview({ quiz, onClose, isLive = false, onComplete, initialSlideIndex = 0, isPublicMode = false, boardId }: QuizPreviewProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(initialSlideIndex);
  const [prevSlideIndex, setPrevSlideIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [responses, setResponses] = useState<SlideResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [showNotePanel, setShowNotePanel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMathPanel, setShowMathPanel] = useState(false);
  
  // Public mode - comments state
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [slideComments, setSlideComments] = useState<BoardComment[]>([]);
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);
  
  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const currentSlide = quiz.slides[currentSlideIndex];
  const currentResponse = responses.find(r => r.slideId === currentSlide?.id);
  
  // Get chapters from slides with chapterName
  const chapters = quiz.slides
    .map((slide, index) => ({
      index,
      name: (slide as InfoSlide).chapterName,
    }))
    .filter(ch => ch.name);
  const hasAnswered = !!currentResponse;
  
  const score = calculateQuizScore(responses, quiz.slides);
  
  // Outer background color (area around slide)
  const bgColor = '#F0F1F8';
  
  // Slide background color from current slide settings
  const slideBgColor = (currentSlide as any)?.slideBackground?.color || '#ffffff';
  const slideTextColor = getContrastColor(slideBgColor);
  
  // Reset on slide change
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
  }, [currentSlideIndex]);
  
  // Preload adjacent slides (previous and next)
  useEffect(() => {
    const preloadSlideImages = (slide: QuizSlide | undefined) => {
      if (!slide) return;
      
      // Collect all image URLs from the slide
      const imageUrls: string[] = [];
      
      // Check for media on activity slides
      if ((slide as any).media?.url && (slide as any).media?.type === 'image') {
        imageUrls.push((slide as any).media.url);
      }
      
      // Check for block-based layouts (info slides)
      if (slide.type === 'info') {
        const infoSlide = slide as InfoSlide;
        if (infoSlide.layout?.blocks) {
          infoSlide.layout.blocks.forEach(block => {
            if (block.type === 'image' && block.content) {
              imageUrls.push(block.content);
              // Also preload gallery images
              if (block.gallery) {
                block.gallery.forEach(url => imageUrls.push(url));
              }
            }
          });
        }
        // Legacy format
        if (infoSlide.imageUrl) {
          imageUrls.push(infoSlide.imageUrl);
        }
      }
      
      // Check for slide background image
      if ((slide as any).slideBackground?.type === 'image' && (slide as any).slideBackground?.imageUrl) {
        imageUrls.push((slide as any).slideBackground.imageUrl);
      }
      
      // Preload each image
      imageUrls.forEach(url => {
        if (url && url.startsWith('http')) {
          const img = new Image();
          img.src = url;
        }
      });
    };
    
    // Preload previous slide
    if (currentSlideIndex > 0) {
      preloadSlideImages(quiz.slides[currentSlideIndex - 1]);
    }
    
    // Preload next slide
    if (currentSlideIndex < quiz.slides.length - 1) {
      preloadSlideImages(quiz.slides[currentSlideIndex + 1]);
    }
  }, [currentSlideIndex, quiz.slides]);
  
  // Load comments for current slide (public mode)
  useEffect(() => {
    if (isPublicMode && boardId && currentSlide) {
      getSlideComments(boardId, currentSlide.id).then(setSlideComments);
      setCommentContent('');
      setCommentSuccess(false);
    }
  }, [isPublicMode, boardId, currentSlide?.id]);
  
  // Load saved author name
  useEffect(() => {
    if (isPublicMode) {
      const saved = localStorage.getItem('public-viewer-author-name');
      if (saved) setCommentAuthorName(saved);
    }
  }, [isPublicMode]);
  
  // Submit comment handler
  const submitComment = async () => {
    if (!boardId || !currentSlide || !commentContent.trim()) return;
    
    console.log('[PublicViewer] Submitting comment:', { boardId, slideId: currentSlide.id, content: commentContent.trim() });
    setSubmittingComment(true);
    try {
      const result = await addBoardComment({
        board_id: boardId,
        slide_id: currentSlide.id,
        author_name: commentAuthorName.trim() || null,
        content: commentContent.trim(),
      });
      
      console.log('[PublicViewer] Comment result:', result);
      
      if (result) {
        setCommentSuccess(true);
        setCommentContent('');
        // Save author name
        if (commentAuthorName.trim()) {
          localStorage.setItem('public-viewer-author-name', commentAuthorName.trim());
        }
        // Reload comments
        const updated = await getSlideComments(boardId, currentSlide.id);
        setSlideComments(updated);
        // Reset success after 3s
        setTimeout(() => setCommentSuccess(false), 3000);
      } else {
        console.error('[PublicViewer] Failed to add comment - result was null');
      }
    } catch (e) {
      console.error('Error submitting comment:', e);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToPrevSlide();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        // In preview mode (not live), allow free navigation
        if (!isLive || hasAnswered || currentSlide?.type !== 'activity') {
          goToNextSlide();
        }
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, hasAnswered, currentSlide]);
  
  const goToNextSlide = useCallback(() => {
    if (currentSlideIndex < quiz.slides.length - 1 && !isAnimating) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 500);
    } else if (currentSlideIndex === quiz.slides.length - 1) {
      setIsCompleted(true);
      onComplete?.(responses);
    }
  }, [quiz, currentSlideIndex, isAnimating, responses, onComplete]);
  
  const goToPrevSlide = useCallback(() => {
    if (currentSlideIndex > 0 && !isAnimating && quiz.settings.allowBack) {
      setIsAnimating(true);
      setPrevSlideIndex(currentSlideIndex);
      setCurrentSlideIndex(prev => prev - 1);
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [currentSlideIndex, isAnimating, quiz.settings.allowBack]);
  
  // Submit answer
  const submitAnswer = () => {
    if (!currentSlide || currentSlide.type !== 'activity') return;
    
    let isCorrect = false;
    let answer: string | string[] = '';
    
    if (currentSlide.activityType === 'abc') {
      const abcSlide = currentSlide as ABCActivitySlide;
      const correctOption = abcSlide.options.find(o => o.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
      answer = selectedOption || '';
    } else if (currentSlide.activityType === 'open') {
      const openSlide = currentSlide as OpenActivitySlide;
      // Use mathematical comparison for numeric answers
      isCorrect = checkMathAnswer(textAnswer, openSlide.correctAnswers);
      answer = textAnswer;
    } else if (currentSlide.activityType === 'example') {
      const exampleSlide = currentSlide as ExampleActivitySlide;
      // Use mathematical comparison for example answers
      const correctAnswers = exampleSlide.finalAnswer ? [exampleSlide.finalAnswer] : [];
      isCorrect = checkMathAnswer(textAnswer, correctAnswers);
      answer = textAnswer;
    }
    
    const response: SlideResponse = {
      slideId: currentSlide.id,
      activityType: currentSlide.activityType as any,
      answer,
      isCorrect,
      points: isCorrect ? (currentSlide as any).points || 1 : 0,
      answeredAt: new Date().toISOString(),
      timeSpent: 0,
    };
    
    setResponses([...responses, response]);
    setShowResult(true);
  };
  
  // Restart
  const restart = () => {
    setCurrentSlideIndex(0);
    setPrevSlideIndex(0);
    setResponses([]);
    setIsCompleted(false);
    setSelectedOption(null);
    setTextAnswer('');
    setShowResult(false);
  };
  
  // Progress bar renderer
  const renderProgressBar = () => {
    const totalSlides = quiz.slides.length;
    const useSimplifiedBar = totalSlides > 30;
    
    if (useSimplifiedBar) {
      // Simplified progress bar for 30+ slides - just one completed and one remaining segment
      const progressPercent = ((currentSlideIndex + 1) / totalSlides) * 100;
      
      return (
        <div 
          className="flex-1 flex rounded-full overflow-hidden cursor-pointer"
          style={{ height: '8px' }}
          onClick={(e) => {
            if (!isAnimating) {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPercent = (e.clientX - rect.left) / rect.width;
              const targetIndex = Math.floor(clickPercent * totalSlides);
              const clampedIndex = Math.max(0, Math.min(targetIndex, totalSlides - 1));
              
              setIsAnimating(true);
              setPrevSlideIndex(currentSlideIndex);
              setCurrentSlideIndex(clampedIndex);
              setTimeout(() => setIsAnimating(false), 400);
            }
          }}
        >
          {/* Completed part */}
          <div
            className="h-full transition-all duration-300"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: '#475569'
            }}
          />
          {/* Remaining part */}
          <div
            className="h-full flex-1"
            style={{ 
              backgroundColor: '#CBD5E1'
            }}
          />
        </div>
      );
    }
    
    // Original segmented progress bar for 30 or fewer slides
    return (
      <>
        {currentSlideIndex >= 0 && (
          <div
            className="rounded-full cursor-pointer hover:opacity-80"
            style={{ 
              height: '8px',
              backgroundColor: '#475569',
              flex: currentSlideIndex + 1
            }}
            onClick={() => {
              if (!isAnimating && currentSlideIndex > 0) {
                setIsAnimating(true);
                setPrevSlideIndex(currentSlideIndex);
                setCurrentSlideIndex(0);
                setTimeout(() => setIsAnimating(false), 400);
              }
            }}
          />
        )}
        {quiz.slides.slice(currentSlideIndex + 1).map((_, idx) => {
          const actualIndex = currentSlideIndex + 1 + idx;
          return (
            <div
              key={actualIndex}
              onClick={() => {
                if (!isAnimating) {
                  setIsAnimating(true);
                  setPrevSlideIndex(currentSlideIndex);
                  setCurrentSlideIndex(actualIndex);
                  setTimeout(() => setIsAnimating(false), 400);
                }
              }}
              className="flex-1 rounded-full cursor-pointer hover:opacity-80"
              style={{ 
                height: '8px',
                backgroundColor: '#CBD5E1'
              }}
            />
          );
        })}
      </>
    );
  };
  
  // Render slide view
  const renderSlideView = (slide: QuizSlide) => {
    switch (slide.type) {
      case 'info':
        return <InfoSlideView slide={slide as InfoSlide} />;
      case 'activity':
        switch ((slide as any).activityType) {
          case 'abc':
            return (
              <ABCSlideView 
                slide={slide as ABCActivitySlide} 
                showSolution={showResult}
                selectedAnswer={selectedOption || undefined}
                onSelectAnswer={setSelectedOption}
              />
            );
          case 'open':
            return (
              <OpenSlideView 
                slide={slide as OpenActivitySlide}
                textAnswer={textAnswer}
                setTextAnswer={setTextAnswer}
                showResult={showResult}
                response={currentResponse}
                onSubmit={submitAnswer}
              />
            );
          case 'example':
            return (
              <ExampleSlideView 
                slide={slide as ExampleActivitySlide}
                textAnswer={textAnswer}
                setTextAnswer={setTextAnswer}
                showResult={showResult}
                response={currentResponse}
                onSubmit={submitAnswer}
                onOpenMathPanel={() => setShowMathPanel(true)}
              />
            );
          case 'board':
            return (
              <BoardSlideView 
                slide={slide as BoardActivitySlide}
                posts={[]} // Preview mode - no live posts
                readOnly={true}
                isTeacher={true}
              />
            );
          case 'voting':
            return (
              <VotingSlideView 
                slide={slide as VotingActivitySlide}
                isTeacher={false}
                voteCounts={{}} // Preview mode - no live votes
                totalVoters={0}
                readOnly={false}
              />
            );
          case 'connect-pairs':
            return (
              <ConnectPairsView 
                slide={slide as ConnectPairsActivitySlide}
                isTeacher={false}
                readOnly={false}
              />
            );
          case 'fill-blanks':
            return (
              <FillBlanksView 
                slide={slide as FillBlanksActivitySlide}
                isTeacher={false}
                readOnly={false}
              />
            );
          case 'image-hotspots':
            return (
              <ImageHotspotsView 
                slide={slide as ImageHotspotsActivitySlide}
                isTeacher={false}
                readOnly={false}
              />
            );
          case 'video-quiz':
            return (
              <VideoQuizView 
                slide={slide as VideoQuizActivitySlide}
                isTeacher={false}
                readOnly={false}
              />
            );
          default:
            return <div className="text-slate-500 text-center">Nepodporovaný typ aktivity</div>;
        }
      default:
        return <div className="text-slate-500 text-center">Nepodporovaný typ slidu</div>;
    }
  };
  
  // Completed screen
  if (isCompleted) {
    return (
      <div className="fixed inset-0 flex flex-col z-50" style={{ backgroundColor: bgColor }}>
        {/* Header */}
        <div className="flex items-center px-4 py-3">
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Results */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Kvíz dokončen!</h2>
            
            <div className="bg-slate-50 rounded-2xl p-6 my-6">
              <div className="text-5xl font-bold text-indigo-600 mb-2">{score.percentage}%</div>
              <p className="text-slate-600">
                {score.correctCount} z {score.correctCount + score.incorrectCount} správně
              </p>
              <div className="flex justify-center gap-4 mt-4">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>{score.correctCount}</span>
                </div>
                <div className="flex items-center gap-1 text-red-500">
                  <XCircle className="w-4 h-4" />
                  <span>{score.incorrectCount}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={restart}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Znovu
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                >
                  Zavřít
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 flex z-50" style={{ backgroundColor: bgColor }}>
      {/* Fixed Close Button - Always in top left corner - ABSOLUTE, doesn't affect layout */}
      {onClose && (
        <div className="hidden lg:block absolute top-0 left-0 z-50 p-4">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      
      {/* Sidebar Area - Desktop - ONLY when sidebar is OPEN - takes space in flex layout */}
      {(showChapterMenu || showNotePanel || showCommentsPanel) && (
        <div className="hidden lg:flex h-full flex-shrink-0">
          {/* Sidebar content - 1/4 of screen width */}
          <div className="flex flex-col flex-shrink-0 bg-white/95 backdrop-blur-sm z-30 border-r border-slate-100" style={{ width: '25vw', minWidth: '280px', maxWidth: '400px' }}>
            <div className="flex-1 overflow-y-auto px-5 py-10" style={{ paddingTop: 100 }}>
              <div className="mb-8">
                <h2 className="text-slate-800 text-lg font-bold leading-tight">{quiz.title}</h2>
              </div>
          
              {showChapterMenu ? (
                /* Chapter list */
                <div className="flex flex-col gap-4">
                  <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2">Osnova:</h3>
                  {chapters.map((chapter, idx) => {
                    const name = chapter.name || '';
                    const isJustNumber = /^\d+\.?$/.test(name.trim());
                    const displayName = isJustNumber ? `Úloha ${name.replace('.', '')}` : name;
                    
                    return (
                      <button
                        key={chapter.index}
                        onClick={() => {
                          if (!isAnimating) {
                            setIsAnimating(true);
                            setPrevSlideIndex(currentSlideIndex);
                            setCurrentSlideIndex(chapter.index);
                            setTimeout(() => setIsAnimating(false), 400);
                          }
                        }}
                        className={`w-full text-left text-base transition-colors ${
                          currentSlideIndex >= chapter.index && 
                          (idx === chapters.length - 1 || currentSlideIndex < chapters[idx + 1].index)
                            ? 'font-bold text-slate-800' 
                            : 'text-slate-600 hover:text-slate-800 font-medium'
                        }`}
                      >
                        <span className="mr-2">{idx + 1}.</span>
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              ) : showNotePanel ? (
                /* Note content */
                <div className="flex flex-col gap-4">
                  <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2">Poznámka:</h3>
                  <p className="text-[#4E5871] text-lg font-medium leading-relaxed">
                    {currentSlide?.note}
                  </p>
                </div>
              ) : showCommentsPanel ? (
                /* Comments panel - public mode */
                <div className="flex flex-col gap-4">
                  <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-2">Komentáře:</h3>
                  
                  {/* Previous comments */}
                  {slideComments.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {slideComments.map((comment) => (
                        <div key={comment.id} className="p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-medium text-slate-600">
                              {comment.author_name || 'Anonymní'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(comment.created_at).toLocaleDateString('cs-CZ')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add comment form */}
                  {commentSuccess ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">Komentář odeslán!</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={commentAuthorName}
                        onChange={(e) => setCommentAuthorName(e.target.value)}
                        placeholder="Vaše jméno (volitelné)"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <textarea
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder="Napište komentář..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                      <button
                        onClick={submitComment}
                        disabled={!commentContent.trim() || submittingComment}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2"
                      >
                        {submittingComment ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Odeslat
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
      
          {/* Buttons next to open sidebar - part of flex layout */}
          <div className="flex flex-col gap-2 p-4" style={{ paddingTop: 64 }}>
            {/* Close button */}
            <button
              onClick={() => { setShowChapterMenu(false); setShowNotePanel(false); setShowCommentsPanel(false); }}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
              title="Zavřít"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
            
            {/* Chapter menu button */}
            {!showChapterMenu && chapters.length > 0 && (
              <button
                onClick={() => { setShowNotePanel(false); setShowCommentsPanel(false); setShowChapterMenu(true); }}
                className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
                title="Osnova"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            
            {/* Note button */}
            {!showNotePanel && currentSlide?.note && (
              <button
                onClick={() => { setShowChapterMenu(false); setShowCommentsPanel(false); setShowNotePanel(true); }}
                className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
                title="Poznámka"
              >
                <NoteIcon size={20} />
              </button>
            )}
            
            {/* Comments button - public mode only */}
            {!showCommentsPanel && isPublicMode && (
              <button
                onClick={() => { setShowChapterMenu(false); setShowNotePanel(false); setShowCommentsPanel(true); }}
                className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
                title="Komentáře"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Buttons when sidebar is CLOSED - ABSOLUTE position, doesn't affect layout */}
      {!showChapterMenu && !showNotePanel && !showCommentsPanel && (chapters.length > 0 || currentSlide?.note || isPublicMode) && (
        <div className="hidden lg:flex absolute top-20 left-4 z-40 flex-col gap-2">
          {chapters.length > 0 && (
            <button
              onClick={() => setShowChapterMenu(true)}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
              title="Osnova"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          {currentSlide?.note && (
            <button
              onClick={() => setShowNotePanel(true)}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700"
              title="Poznámka"
            >
              <NoteIcon size={20} />
            </button>
          )}
          {isPublicMode && (
            <button
              onClick={() => setShowCommentsPanel(true)}
              className="w-10 h-10 rounded-full backdrop-blur shadow-sm flex items-center justify-center transition-colors bg-indigo-500 text-white hover:bg-indigo-600"
              title="Komentáře"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        
        {/* Score - Desktop - temporarily hidden, will be added back via settings */}
        {/* {quiz.settings.showScore && (
          <div className="hidden lg:flex absolute top-0 right-0 z-20 items-center gap-4 p-4">
            <div className="flex items-center gap-1 text-red-500">
              <XCircle className="w-5 h-5" />
              <span className="font-bold">{score.incorrectCount}</span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold">{score.correctCount}</span>
            </div>
          </div>
        )} */}
      
        {/* Mobile: Top navigation - EXACT copy from QuizStudentView */}
        <div className="flex lg:hidden items-center gap-3 px-4 py-4" style={{ backgroundColor: '#F0F1F8' }}>
          {/* Comment button for public mode - same style as other buttons */}
          {isPublicMode && (
            <button
              onClick={() => setShowCommentsPanel(!showCommentsPanel)}
              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                showCommentsPanel 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-[#CBD5E1] text-slate-600'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          )}
          
          {/* Menu button for chapters - only when NOT in public mode */}
          {chapters.length > 0 && !isPublicMode && (
            <button
              onClick={() => setShowChapterMenu(!showChapterMenu)}
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-[#CBD5E1] text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
      
          {/* Left arrow - exact copy from QuizStudentView */}
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0 || !quiz.settings.allowBack}
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${currentSlideIndex === 0 || !quiz.settings.allowBack ? 'opacity-30 cursor-not-allowed' : ''} bg-[#CBD5E1] text-slate-600`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        
          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-1.5">
            {renderProgressBar()}
          </div>
        
          {/* Right arrow - exact copy from QuizStudentView */}
          <button
            onClick={() => {
              if (!isLive || hasAnswered || currentSlide?.type !== 'activity') {
                goToNextSlide();
              } else if (selectedOption || textAnswer.trim()) {
                submitAnswer();
              }
            }}
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      
      {/* Main content area with arrows - exact copy from QuizStudentView */}
      <div 
        className="flex-1 flex flex-col overflow-hidden" 
        style={{ 
          backgroundColor: '#F0F1F8',
          minHeight: 0,
        }}
      >
        {/* Desktop: Segmented progress bar - above slide, within 40px top margin */}
        <div 
          className="hidden lg:flex items-end justify-center flex-shrink-0"
          style={{ height: 40, paddingBottom: 8 }}
        >
          <div className="w-1/2 max-w-xl flex items-center gap-1.5">
            {renderProgressBar()}
          </div>
        </div>
        
        {/* Content with arrows - with bottom padding */}
        <div className="flex-1 flex items-stretch overflow-hidden" style={{ 
          minHeight: 0, 
          paddingBottom: isMobile ? 8 : 5,
        }}>
          {/* Desktop: Left arrow - same width as right arrow for symmetry */}
          <div 
            className="hidden lg:flex flex-shrink-0 items-center justify-center"
            style={{ width: 65 }}
          >
            <button
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0 || !quiz.settings.allowBack}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ease-out bg-[#CBD5E1] text-slate-600 ${
                currentSlideIndex === 0 || !quiz.settings.allowBack ? 'opacity-30 cursor-not-allowed' : 'hover:h-28'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          
          {/* Slide content - fills remaining space */}
          <div 
            className="flex-1"
            style={{ 
              minHeight: 0,
              overflowY: isMobile ? 'auto' : 'hidden',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              // Padding for shadow visibility
              padding: isMobile ? 8 : 16,
            }}
          >
            {/* Slide card - exact copy from QuizStudentView */}
            <div 
              className={`
                w-full rounded-3xl shadow-md overflow-hidden flex flex-col
                ${currentSlide?.type !== 'info' ? 'max-w-5xl mx-auto' : ''}
                ${currentSlideIndex > prevSlideIndex && isAnimating ? 'animate-slide-in' : ''}
                ${currentSlideIndex < prevSlideIndex && isAnimating ? 'animate-slide-in-left' : ''}
              `}
              style={{
                // Fill available space - on mobile, use minHeight to ensure background extends
                height: isMobile ? 'auto' : '100%',
                minHeight: isMobile ? 'calc(100vh - 140px)' : undefined,
                // Dynamic background and text color based on slide settings
                backgroundColor: slideBgColor,
                color: slideTextColor,
              }}
              key={currentSlideIndex}
            >
              {currentSlide ? (
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                }}>
                  {renderSlideView(currentSlide)}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <p className="text-xl">Žádné slidy</p>
                </div>
              )}
              
              {/* Submit button for activities */}
              {currentSlide?.type === 'activity' && !hasAnswered && (selectedOption || textAnswer.trim()) && (
                <div className="p-6 flex justify-center border-t border-slate-100">
                  <button
                    onClick={submitAnswer}
                    className="px-8 py-3 rounded-xl font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Odpovědět
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Desktop: Right arrow */}
          <div className="hidden lg:flex flex-shrink-0 items-center justify-center" style={{ width: 65 }}>
            <button
              onClick={() => {
                // In preview mode (not live), allow free navigation
                if (!isLive || hasAnswered || currentSlide?.type !== 'activity') {
                  goToNextSlide();
                } else if (selectedOption || textAnswer.trim()) {
                  submitAnswer();
                }
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-300 ease-out hover:h-28"
              style={{ backgroundColor: '#7C3AED' }}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      </div> {/* End of Main content wrapper */}
      
      {/* Mobile Chapter Sidebar - overlay */}
      {showChapterMenu && chapters.length > 0 && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20"
            onClick={() => setShowChapterMenu(false)}
          />
          
          {/* Sidebar - mobile */}
          <div className="relative bg-white shadow-2xl flex flex-col" style={{ width: '75vw', maxWidth: '320px' }}>
            {/* Header */}
            <div className="p-4 flex items-center gap-3 border-b border-slate-100">
              <button
                onClick={() => setShowChapterMenu(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="font-semibold text-slate-700 text-base">Kapitoly</span>
            </div>
            
            {/* Chapter list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {chapters.map((chapter, idx) => {
                // Format chapter name - if it's just a number, add "Úloha" prefix
                const name = chapter.name || '';
                const isJustNumber = /^\d+\.?$/.test(name.trim());
                const displayName = isJustNumber ? `Úloha ${name.replace('.', '')}` : name;
                
                return (
                <button
                  key={chapter.index}
                  onClick={() => {
                    if (!isAnimating) {
                      setIsAnimating(true);
                      setPrevSlideIndex(currentSlideIndex);
                      setCurrentSlideIndex(chapter.index);
                      setTimeout(() => setIsAnimating(false), 400);
                    }
                    setShowChapterMenu(false);
                  }}
                    className={`w-full text-left py-2 text-base transition-colors ${
                    currentSlideIndex >= chapter.index && 
                    (idx === chapters.length - 1 || currentSlideIndex < chapters[idx + 1].index)
                      ? 'font-semibold text-slate-800' 
                      : 'text-slate-600'
                  }`}
                >
                  <span className="text-slate-400 mr-2">{idx + 1}.</span>
                    {displayName}
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Comments Panel - simple overlay matching student view style */}
      {showCommentsPanel && isPublicMode && isMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header - simple like chapter menu */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
            <button
              onClick={() => setShowCommentsPanel(false)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="font-semibold text-slate-700 text-base">Komentáře ({currentSlideIndex + 1}/{quiz.slides.length})</span>
          </div>
          
          {/* Comments list */}
          <div className="flex-1 overflow-y-auto p-4">
            {slideComments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-base">Zatím žádné komentáře</p>
              </div>
            ) : (
              <div className="space-y-3">
                {slideComments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-600">
                        {comment.author_name || 'Anonym'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(comment.created_at).toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Add comment form */}
          <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-white">
            {commentSuccess ? (
              <div className="text-center py-4 text-green-600">
                <CheckCircle className="w-8 h-8 mx-auto mb-1" />
                <p className="text-sm font-medium">Komentář odeslán!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={commentAuthorName}
                  onChange={(e) => setCommentAuthorName(e.target.value)}
                  placeholder="Vaše jméno (volitelné)"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <textarea
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Napište komentář..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <button
                  onClick={submitComment}
                  disabled={!commentContent.trim() || submittingComment}
                  className={`w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 ${
                    commentContent.trim() && !submittingComment
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {submittingComment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Odesílám...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Odeslat komentář
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Math Keyboard Panel - slides in from right */}
      <div 
        className={`
          hidden lg:flex flex-col transition-all duration-300 ease-out flex-shrink-0
        `}
        style={{ 
          backgroundColor: '#1e2533', 
          overflow: 'hidden',
          width: showMathPanel ? '320px' : '0px',
        }}
      >
        {showMathPanel && (
          <div className="flex flex-col h-full p-3" style={{ width: '320px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">Kalkulačka</h3>
              <button
                onClick={() => setShowMathPanel(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Math Keyboard - fits panel width */}
            <div className="flex-1 overflow-hidden" style={{ maxWidth: '100%' }}>
              <MathKeyboard
                value={textAnswer}
                onChange={setTextAnswer}
                onClose={() => setShowMathPanel(false)}
                showPreview={true}
                mode="inline"
                compact={true}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Mobile Math Keyboard - modal overlay */}
      {showMathPanel && isMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Kalkulačka</h3>
              <button
                onClick={() => setShowMathPanel(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto">
              <MathKeyboard
                value={textAnswer}
                onChange={setTextAnswer}
                onClose={() => setShowMathPanel(false)}
                showPreview={true}
                mode="inline"
                compact={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizPreview;
