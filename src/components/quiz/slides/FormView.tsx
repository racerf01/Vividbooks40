/**
 * Form Slide View (Formulář)
 * 
 * Display form for students to fill out
 */

import React, { useState, useRef, useEffect } from 'react';
import { FormActivitySlide, FormField } from '../../../types/quiz';
import { FileText, AlertCircle, ChevronDown } from 'lucide-react';

interface FormViewProps {
  slide: FormActivitySlide;
  answer: Record<string, string | string[]>;
  onAnswerChange: (answer: Record<string, string | string[]>) => void;
  isReadOnly?: boolean;
}

// Single field view
function FieldView({
  field,
  value,
  onChange,
  isReadOnly,
}: {
  field: FormField;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  isReadOnly?: boolean;
}) {
  const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
  const showError = field.required && isEmpty;

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="block font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Field input based on type */}
      {field.type === 'short-text' && (
        <input
          type="text"
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={isReadOnly}
          className={`w-full px-4 py-3 rounded-xl border-2 ${
            showError 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
              : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20'
          } outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500`}
        />
      )}

      {field.type === 'long-text' && (
        <textarea
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={isReadOnly}
          rows={4}
          className={`w-full px-4 py-3 rounded-xl border-2 ${
            showError 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
              : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20'
          } outline-none transition-colors resize-none disabled:bg-slate-50 disabled:text-slate-500`}
        />
      )}

      {field.type === 'checkboxes' && (
        <div className="grid grid-cols-2 gap-2">
          {(field.options || []).map((option, index) => {
            const isChecked = Array.isArray(value) && value.includes(option);
            return (
              <label
                key={index}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                  isChecked
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      onChange([...currentValues, option]);
                    } else {
                      onChange(currentValues.filter(v => v !== option));
                    }
                  }}
                  disabled={isReadOnly}
                  className="w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="flex-1 text-slate-700">{option}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === 'radio' && (
        <div className="grid grid-cols-2 gap-2">
          {(field.options || []).map((option, index) => {
            const isSelected = value === option;
            return (
              <label
                key={index}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  checked={isSelected}
                  onChange={() => onChange(option)}
                  disabled={isReadOnly}
                  className="w-5 h-5 border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="flex-1 text-slate-700">{option}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === 'dropdown' && (
        <select
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={isReadOnly}
          className={`w-full px-4 py-3 rounded-xl border-2 ${
            showError 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
              : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20'
          } outline-none transition-colors bg-white disabled:bg-slate-50 disabled:text-slate-500`}
        >
          <option value="">Vyberte možnost...</option>
          {(field.options || []).map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {/* Error message */}
      {showError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Toto pole je povinné</span>
        </div>
      )}
    </div>
  );
}

export function FormView({ slide, answer, onAnswerChange, isReadOnly }: FormViewProps) {
  // Safe access to fields
  const fields = slide.fields || [];
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [needsScroll, setNeedsScroll] = useState(false);
  
  const handleFieldChange = (fieldId: string, value: string | string[]) => {
    onAnswerChange({
      ...answer,
      [fieldId]: value,
    });
  };

  // Check if content needs scrolling
  useEffect(() => {
    const checkScrollNeeded = () => {
      const container = scrollContainerRef.current;
      if (container) {
        const needsScrolling = container.scrollHeight > container.clientHeight + 20;
        setNeedsScroll(needsScrolling);
        if (!needsScrolling) {
          setHasScrolledToBottom(true);
        }
      }
    };
    
    // Check after a short delay to ensure content is rendered
    const timeout = setTimeout(checkScrollNeeded, 100);
    window.addEventListener('resize', checkScrollNeeded);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', checkScrollNeeded);
    };
  }, [fields.length]);

  // Handle scroll to detect when user reaches bottom
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 30;
      if (isAtBottom) {
        setHasScrolledToBottom(true);
      }
    }
  };

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-6 md:p-8 bg-white rounded-3xl relative"
    >
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        {slide.instruction && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <p className="text-slate-700 leading-relaxed">{slide.instruction}</p>
            </div>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-6">
          {fields.map((field) => (
            <FieldView
              key={field.id}
              field={field}
              value={answer?.[field.id] || (field.type === 'checkboxes' ? [] : '')}
              onChange={(value) => handleFieldChange(field.id, value)}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>

        {/* No fields message */}
        {fields.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Formulář zatím neobsahuje žádná pole</p>
          </div>
        )}
        
        {/* Extra space at bottom for scroll indicator */}
        {needsScroll && <div className="h-16" />}
      </div>

      {/* Scroll indicator - fixed at bottom */}
      {needsScroll && !hasScrolledToBottom && (
        <div className="sticky bottom-0 left-0 right-0 pointer-events-none pb-4">
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-violet-600 bg-white px-4 py-2 rounded-full shadow-lg border border-violet-200 pointer-events-auto animate-bounce">
              <ChevronDown className="w-4 h-4" />
              <span className="text-sm font-medium">Scrolluj pro více polí</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
