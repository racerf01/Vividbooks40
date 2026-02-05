/**
 * Form Slide Editor (Formulář)
 * 
 * Editor for creating custom forms with various field types
 * Supports: short text, long text, checkboxes, radio buttons, dropdown
 */

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  FileText,
  AlignLeft,
  CheckSquare,
  Circle,
  ChevronDown,
  X,
  ChevronUp,
} from 'lucide-react';
import { FormActivitySlide, FormField, FormFieldType } from '../../../types/quiz';
import { getContrastColor } from '../../../utils/color-utils';

interface FormEditorProps {
  slide: FormActivitySlide;
  onUpdate: (id: string, updates: Partial<FormActivitySlide>) => void;
}

// Toggle Switch component
const ToggleSwitch = ({ 
  enabled, 
  onChange, 
  label, 
  description 
}: { 
  enabled: boolean; 
  onChange: (v: boolean) => void; 
  label: string;
  description?: string;
}) => (
  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
    <div className="flex-1">
      <span className="font-medium text-slate-700">{label}</span>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
    <div 
      className="relative flex-shrink-0"
      style={{ 
        width: '52px', 
        height: '28px', 
        borderRadius: '14px',
        backgroundColor: enabled ? '#7C3AED' : '#94a3b8',
        transition: 'background-color 0.2s ease',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
      }}
    >
      <div 
        style={{ 
          position: 'absolute',
          top: '2px',
          left: enabled ? '26px' : '2px',
          width: '24px', 
          height: '24px', 
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'left 0.2s ease'
        }}
      />
    </div>
    <input
      type="checkbox"
      checked={enabled}
      onChange={(e) => onChange(e.target.checked)}
      className="sr-only"
    />
  </label>
);

// Field type selector
const FIELD_TYPES: { type: FormFieldType; icon: React.ReactNode; label: string }[] = [
  { type: 'short-text', icon: <AlignLeft className="w-4 h-4" />, label: 'Krátká odpověď' },
  { type: 'long-text', icon: <FileText className="w-4 h-4" />, label: 'Dlouhá odpověď' },
  { type: 'checkboxes', icon: <CheckSquare className="w-4 h-4" />, label: 'Checkboxy' },
  { type: 'radio', icon: <Circle className="w-4 h-4" />, label: 'Výběr jedné' },
  { type: 'dropdown', icon: <ChevronDown className="w-4 h-4" />, label: 'Rozbalovací seznam' },
];

// Single field editor
function FieldEditor({
  field,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  field: FormField;
  index: number;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [newOption, setNewOption] = useState('');

  const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === field.type);
  const needsOptions = field.type === 'checkboxes' || field.type === 'radio' || field.type === 'dropdown';

  const addOption = () => {
    if (newOption.trim()) {
      const currentOptions = field.options || [];
      onUpdate({ options: [...currentOptions, newOption.trim()] });
      setNewOption('');
    }
  };

  const removeOption = (optionIndex: number) => {
    const currentOptions = field.options || [];
    onUpdate({ options: currentOptions.filter((_, i) => i !== optionIndex) });
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Move up/down buttons */}
        <div className="flex flex-col gap-0.5 pt-1">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className={`p-1.5 rounded-lg hover:bg-slate-100 ${!canMoveUp ? 'opacity-30 cursor-not-allowed' : 'text-slate-500'}`}
            title="Posunout nahoru"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className={`p-1.5 rounded-lg hover:bg-slate-100 ${!canMoveDown ? 'opacity-30 cursor-not-allowed' : 'text-slate-500'}`}
            title="Posunout dolů"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Field content */}
        <div className="flex-1 min-w-0">
          {/* Type badge and label */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium">
              {fieldTypeInfo?.icon}
              <span>{fieldTypeInfo?.label}</span>
            </div>
            {field.required && (
              <span className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-medium">
                Povinné
              </span>
            )}
          </div>

          {/* Label input */}
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Otázka / nadpis pole..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium focus:border-violet-500 outline-none mb-2"
          />

          {/* Placeholder for text inputs */}
          {(field.type === 'short-text' || field.type === 'long-text') && (
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              placeholder="Placeholder text (volitelné)..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 focus:border-violet-500 outline-none"
            />
          )}

          {/* Options for checkboxes, radio, dropdown - always visible */}
          {needsOptions && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-slate-600">Možnosti:</p>
              {(field.options || []).map((option, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs w-6">{optIndex + 1}.</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(field.options || [])];
                      newOptions[optIndex] = e.target.value;
                      onUpdate({ options: newOptions });
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none"
                  />
                  <button
                    onClick={() => removeOption(optIndex)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              
              {/* Add new option */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs w-6">+</span>
                <input
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder="Nová možnost..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:border-violet-500 outline-none"
                />
                <button
                  onClick={addOption}
                  disabled={!newOption.trim()}
                  className="p-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-1">
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 text-red-500"
            title="Smazat pole"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Required toggle */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          />
          <span className="text-slate-600">Povinné pole</span>
        </label>
      </div>
    </div>
  );
}

export function FormEditor({ slide, onUpdate }: FormEditorProps) {
  const [editingInstruction, setEditingInstruction] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Ensure fields array exists
  const fields = slide.fields || [];

  const addField = (type: FormFieldType) => {
    const newField: FormField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      label: '',
      required: false,
      placeholder: type === 'short-text' || type === 'long-text' ? '' : undefined,
      options: type === 'checkboxes' || type === 'radio' || type === 'dropdown' ? ['Možnost 1', 'Možnost 2'] : undefined,
    };

    onUpdate(slide.id, {
      fields: [...fields, newField],
    });
    setShowAddMenu(false);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    const newFields = fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    );
    onUpdate(slide.id, { fields: newFields });
  };

  const deleteField = (fieldId: string) => {
    onUpdate(slide.id, {
      fields: fields.filter(f => f.id !== fieldId),
    });
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const index = fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    onUpdate(slide.id, { fields: newFields });
  };

  // Get background color like other editors
  const bgColor = (slide as any).slideBackground?.color || '#ffffff';
  const textColor = getContrastColor(bgColor);

  return (
    <div className="rounded-2xl" style={{ backgroundColor: bgColor, color: textColor }}>
      {/* Header - same as ExampleSlideEditor */}
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm mb-1" style={{ opacity: 0.7 }}>
          <FileText className="w-4 h-4" />
          <span>Formulář</span>
        </div>
        <h2 className="font-bold text-lg">Vlastní formulář</h2>
      </div>
      
      {/* Instruction input */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Instrukce (volitelné)
          </label>
        </div>
        <input
          type="text"
          value={slide.instruction || ''}
          onChange={(e) => onUpdate(slide.id, { instruction: e.target.value })}
          placeholder="Vyplňte prosím následující formulář..."
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-violet-500 outline-none"
        />
      </div>

      {/* Fields list */}
      <div className="p-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Pole formuláře
        </label>
        
        <div className="space-y-3">
          {fields.length === 0 && (
            <p className="text-slate-400 text-sm italic mb-3">Zatím nemáte žádná pole</p>
          )}
          
          {fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={index}
              onUpdate={(updates) => updateField(field.id, updates)}
              onDelete={() => deleteField(field.id)}
              onMoveUp={() => moveField(field.id, 'up')}
              onMoveDown={() => moveField(field.id, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < fields.length - 1}
            />
          ))}

          {/* Add field button - inline menu instead of dropdown */}
          {!showAddMenu ? (
            <button
              onClick={() => setShowAddMenu(true)}
              className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-violet-500 hover:bg-violet-50 text-slate-500 hover:text-violet-600 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>{fields.length === 0 ? 'Přidat první pole' : 'Přidat další pole'}</span>
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Vyberte typ pole:</span>
                <button
                  onClick={() => setShowAddMenu(false)}
                  className="p-1 rounded hover:bg-slate-200 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {FIELD_TYPES.map((fieldType) => (
                <button
                  key={fieldType.type}
                  onClick={() => addField(fieldType.type)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-b-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                    {fieldType.icon}
                  </div>
                  <span className="font-medium text-slate-700">{fieldType.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
