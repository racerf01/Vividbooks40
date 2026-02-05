/**
 * Certificate Editor
 * 
 * Editor for configuring certificate generation
 * Allows linking fields to form data from other slides
 * Supports custom PDF/image templates
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  Award,
  Plus,
  Trash2,
  Image as ImageIcon,
  Link2,
  Type,
  Calendar,
  User,
  FileText,
  ChevronDown,
  Upload,
  X,
} from 'lucide-react';
import { ToolsSlide, CertificateConfig, CertificateFieldSource, CertificateColumn, Quiz, FormActivitySlide, FormField } from '../../../types/quiz';
import { supabase } from '../../../utils/supabase/client';

interface CertificateEditorProps {
  slide: ToolsSlide;
  onUpdate: (id: string, updates: Partial<ToolsSlide>) => void;
  quiz: Quiz; // Need access to quiz to find form fields
}

// Helper to get all form fields from the quiz
function getFormFieldsFromQuiz(quiz: Quiz): { slideId: string; slideName: string; fields: FormField[] }[] {
  const result: { slideId: string; slideName: string; fields: FormField[] }[] = [];
  
  quiz.slides.forEach((slide, index) => {
    if (slide.type === 'activity' && (slide as any).activityType === 'form') {
      const formSlide = slide as FormActivitySlide;
      if (formSlide.fields && formSlide.fields.length > 0) {
        result.push({
          slideId: slide.id,
          slideName: `Slide ${index + 1}: ${formSlide.instruction || 'Formulář'}`,
          fields: formSlide.fields,
        });
      }
    }
  });
  
  return result;
}

// Field source selector component
function FieldSourceSelector({
  label,
  source,
  onChange,
  formFields,
  allowAuto = false,
}: {
  label: string;
  source: CertificateFieldSource;
  onChange: (source: CertificateFieldSource) => void;
  formFields: { slideId: string; slideName: string; fields: FormField[] }[];
  allowAuto?: boolean;
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  const getSourceLabel = () => {
    if (source.type === 'manual') return 'Ruční zadání';
    if (source.type === 'auto') return 'Automaticky (dnešní datum)';
    if (source.type === 'form-field') {
      const slide = formFields.find(f => f.slideId === source.slideId);
      const field = slide?.fields.find(f => f.id === source.fieldId);
      return field ? `${slide?.slideName} → ${field.label || 'Bez názvu'}` : 'Vybrat pole...';
    }
    return 'Vybrat zdroj...';
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-left flex items-center justify-between hover:border-violet-500 transition-colors"
        >
          <span className="text-slate-700">{getSourceLabel()}</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {showDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 z-20 overflow-hidden max-h-64 overflow-y-auto">
              {/* Manual option */}
              <button
                onClick={() => {
                  onChange({ type: 'manual', value: source.value || '' });
                  setShowDropdown(false);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 ${source.type === 'manual' ? 'bg-violet-50' : ''}`}
              >
                <Type className="w-4 h-4 text-slate-500" />
                <span>Ruční zadání</span>
              </button>

              {/* Auto option (for dates) */}
              {allowAuto && (
                <button
                  onClick={() => {
                    onChange({ type: 'auto' });
                    setShowDropdown(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 ${source.type === 'auto' ? 'bg-violet-50' : ''}`}
                >
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>Automaticky (dnešní datum)</span>
                </button>
              )}

              {/* Form fields */}
              {formFields.length > 0 ? (
                formFields.map((formSlide) => (
                  <div key={formSlide.slideId}>
                    <div className="px-4 py-2 bg-slate-50 text-xs font-medium text-slate-500">
                      {formSlide.slideName}
                    </div>
                    {formSlide.fields.map((field) => (
                      <button
                        key={field.id}
                        onClick={() => {
                          onChange({
                            type: 'form-field',
                            slideId: formSlide.slideId,
                            fieldId: field.id,
                          });
                          setShowDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 pl-8 ${
                          source.type === 'form-field' && source.slideId === formSlide.slideId && source.fieldId === field.id
                            ? 'bg-violet-50'
                            : ''
                        }`}
                      >
                        <Link2 className="w-4 h-4 text-violet-500" />
                        <span>{field.label || 'Bez názvu'}</span>
                      </button>
                    ))}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-slate-400 text-sm italic">
                  Žádné formuláře v boardu
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Manual input field */}
      {source.type === 'manual' && (
        <input
          type="text"
          value={source.value || ''}
          onChange={(e) => onChange({ ...source, value: e.target.value })}
          placeholder="Zadejte hodnotu..."
          className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none"
        />
      )}
    </div>
  );
}

export function CertificateEditor({ slide, onUpdate, quiz }: CertificateEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const config = slide.certificateConfig || {
    title: 'CERTIFIKÁT',
    subtitle: '',
    organizationName: '',
    nameSource: { type: 'manual', value: '' },
    dateOfBirthSource: { type: 'manual', value: '' },
    issueDate: { type: 'auto' },
    columns: [
      { title: 'Popis programu', content: '' },
      { title: 'Podpis', content: '' },
      { title: 'Organizace', content: '' },
    ],
    useCustomTemplate: false,
  };

  const formFields = useMemo(() => getFormFieldsFromQuiz(quiz), [quiz]);

  const updateConfig = (updates: Partial<CertificateConfig>) => {
    onUpdate(slide.id, {
      certificateConfig: { ...config, ...updates },
    });
  };

  const updateColumn = (index: number, updates: Partial<CertificateColumn>) => {
    const newColumns = [...config.columns];
    newColumns[index] = { ...newColumns[index], ...updates };
    updateConfig({ columns: newColumns });
  };

  const addColumn = () => {
    if (config.columns.length < 4) {
      updateConfig({
        columns: [...config.columns, { title: 'Nový sloupec', content: '' }],
      });
    }
  };

  const removeColumn = (index: number) => {
    if (config.columns.length > 1) {
      updateConfig({
        columns: config.columns.filter((_, i) => i !== index),
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept images and PDFs
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Prosím nahrajte obrázek nebo PDF soubor');
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `cert-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error } = await supabase.storage
        .from('teacher-files')
        .upload(`certificates/${fileName}`, file);
      
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('teacher-files')
        .getPublicUrl(`certificates/${fileName}`);

      updateConfig({ 
        customPdfUrl: urlData.publicUrl,
        useCustomTemplate: true,
        customNamePosition: { top: '55%', left: '50%' },
        customDatePosition: { top: '62%', left: '50%' },
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Nepodařilo se nahrát soubor');
    } finally {
      setIsUploading(false);
    }
  };

  const removeCustomTemplate = () => {
    updateConfig({
      customPdfUrl: undefined,
      useCustomTemplate: false,
    });
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2 text-sm mb-1 text-slate-500">
          <Award className="w-4 h-4" />
          <span>Nástroj</span>
        </div>
        <h2 className="font-bold text-lg text-slate-800">Certifikát</h2>
      </div>

      {/* Main settings */}
      <div className="p-6 space-y-6">
        {/* Template type selector */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Typ certifikátu</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateConfig({ useCustomTemplate: false })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                !config.useCustomTemplate
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Award className="w-8 h-8 mx-auto mb-2 text-violet-500" />
              <p className="font-medium text-sm">Vytvořit vlastní</p>
              <p className="text-xs text-slate-500 mt-1">Nastavte texty a design</p>
            </button>
            <button
              onClick={() => updateConfig({ useCustomTemplate: true })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                config.useCustomTemplate
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-violet-500" />
              <p className="font-medium text-sm">Nahrát šablonu</p>
              <p className="text-xs text-slate-500 mt-1">PDF nebo obrázek</p>
            </button>
          </div>
        </div>

        {/* Custom template upload */}
        {config.useCustomTemplate && (
          <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
            {config.customPdfUrl ? (
              <div className="space-y-3">
                <div className="relative">
                  <img 
                    src={config.customPdfUrl} 
                    alt="Custom template" 
                    className="w-full rounded-lg border border-slate-200"
                  />
                  <button
                    onClick={removeCustomTemplate}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Jméno a datum narození se automaticky vloží na certifikát
                </p>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-violet-500 hover:bg-violet-50 transition-all"
              >
                {isUploading ? (
                  <div className="text-slate-500">
                    <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm">Nahrávání...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <p className="font-medium text-slate-700">Klikněte pro nahrání</p>
                    <p className="text-sm text-slate-500 mt-1">PDF nebo obrázek certifikátu</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Default template settings */}
        {!config.useCustomTemplate && (
          <>
            {/* Title */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Hlavní titulek</label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => updateConfig({ title: e.target.value })}
                placeholder="CERTIFIKÁT"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-lg font-bold text-center focus:border-violet-500 outline-none"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Podtitulek (volitelný)</label>
              <input
                type="text"
                value={config.subtitle || ''}
                onChange={(e) => updateConfig({ subtitle: e.target.value })}
                placeholder="např. DVPP"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-center focus:border-violet-500 outline-none"
              />
            </div>

            {/* Organization name */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Název organizace</label>
              <input
                type="text"
                value={config.organizationName || ''}
                onChange={(e) => updateConfig({ organizationName: e.target.value })}
                placeholder="např. VIVIDBOOKS"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-violet-500 outline-none"
              />
            </div>

            <hr className="border-slate-200" />

            {/* Columns */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Spodní sloupce</label>
                {config.columns.length < 4 && (
                  <button
                    onClick={addColumn}
                    className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700"
                  >
                    <Plus className="w-4 h-4" />
                    Přidat sloupec
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {config.columns.map((column, index) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Sloupec {index + 1}</span>
                      {config.columns.length > 1 && (
                        <button
                          onClick={() => removeColumn(index)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={column.title}
                      onChange={(e) => updateColumn(index, { title: e.target.value })}
                      placeholder="Nadpis sloupce"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:border-violet-500 outline-none"
                    />
                    <textarea
                      value={column.content}
                      onChange={(e) => updateColumn(index, { content: e.target.value })}
                      placeholder="Obsah sloupce..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <hr className="border-slate-200" />

        {/* Data sources - always visible */}
        <div className="space-y-4">
          <h3 className="font-medium text-slate-800">Zdroje dat</h3>
          
          {/* Name source */}
          <FieldSourceSelector
            label="Jméno účastníka"
            source={config.nameSource}
            onChange={(source) => updateConfig({ nameSource: source })}
            formFields={formFields}
          />

          {/* Date of birth source */}
          <FieldSourceSelector
            label="Datum narození (volitelné)"
            source={config.dateOfBirthSource || { type: 'manual', value: '' }}
            onChange={(source) => updateConfig({ dateOfBirthSource: source })}
            formFields={formFields}
          />

          {/* Issue date */}
          <FieldSourceSelector
            label="Datum vydání"
            source={config.issueDate || { type: 'auto' }}
            onChange={(source) => updateConfig({ issueDate: source })}
            formFields={formFields}
            allowAuto={true}
          />
        </div>
      </div>
    </div>
  );
}
