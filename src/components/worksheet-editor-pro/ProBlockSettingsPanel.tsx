/**
 * ProBlockSettingsPanel - Dark mode block settings panel for PRO editor
 * 
 * Simplified version of BlockSettingsOverlay with dark theme.
 */

import { useState, useRef } from 'react';
import {
  X,
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Info,
  ListChecks,
  TextCursorInput,
  MessageSquare,
  Calculator,
  ImageIcon,
  Table,
  FileText,
  QrCode,
  Square,
  LayoutGrid,
  ChevronDown as ChevronDownIcon,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignVerticalJustifyCenter,
  Palette,
  Check,
} from 'lucide-react';
import {
  WorksheetBlock,
  BlockType,
  HeadingBlock,
  ParagraphBlock,
  InfoboxBlock,
  MultipleChoiceBlock,
  FillBlankBlock,
  FreeAnswerBlock,
  SpacerBlock,
  ImageBlock,
  InfoboxVariant,
  SpacerStyle,
  FreeCanvasBlock,
} from '../../types/worksheet';
import { toast } from 'sonner';

interface ProBlockSettingsPanelProps {
  block: WorksheetBlock;
  onClose: () => void;
  onUpdateBlock: (id: string, updates: Partial<WorksheetBlock>) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  gridColumns?: number;
}

const BLOCK_ICONS: Record<BlockType, typeof Type> = {
  'heading': Type,
  'paragraph': AlignLeft,
  'infobox': Info,
  'multiple-choice': ListChecks,
  'fill-blank': TextCursorInput,
  'free-answer': MessageSquare,
  'connect-pairs': Type,
  'image-hotspots': Type,
  'video-quiz': Type,
  'examples': Calculator,
  'table': Table,
  'spacer': Square,
  'image': ImageIcon,
  'qr-code': QrCode,
  'header-footer': FileText,
  'free-canvas': Palette,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  'heading': 'Nadpis',
  'paragraph': 'Odstavec',
  'infobox': 'Infobox',
  'multiple-choice': 'Výběr odpovědi',
  'fill-blank': 'Doplňování',
  'free-answer': 'Volná odpověď',
  'connect-pairs': 'Spojovačka',
  'image-hotspots': 'Poznávačka',
  'video-quiz': 'Video kvíz',
  'examples': 'Příklady',
  'table': 'Tabulka',
  'spacer': 'Volný prostor',
  'image': 'Obrázek',
  'qr-code': 'QR kód',
  'header-footer': 'Hlavička',
  'free-canvas': 'Volné plátno',
};

const INFOBOX_VARIANTS: { value: InfoboxVariant; label: string; color: string }[] = [
  { value: 'blue', label: 'Modrá', color: '#3B82F6' },
  { value: 'green', label: 'Zelená', color: '#10B981' },
  { value: 'yellow', label: 'Žlutá', color: '#F59E0B' },
  { value: 'purple', label: 'Fialová', color: '#8B5CF6' },
];

const SPACER_STYLES: { value: SpacerStyle; label: string }[] = [
  { value: 'empty', label: 'Prázdný' },
  { value: 'dotted', label: 'Tečky' },
  { value: 'lined', label: 'Linky' },
];

// Font options for typography
const FONT_FAMILIES = [
  { value: "'Fenomen Sans', sans-serif", label: 'Fenomen Sans' },
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Comic Neue', cursive", label: 'Comic Neue' },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64];

const TEXT_COLORS = [
  // Row 1 - Blacks & Grays
  { value: '#000000', label: 'Černá' },
  { value: '#1F2937', label: 'Antracit' },
  { value: '#374151', label: 'Tmavě šedá' },
  { value: '#6B7280', label: 'Šedá' },
  { value: '#9CA3AF', label: 'Světle šedá' },
  { value: '#D1D5DB', label: 'Stříbrná' },
  // Row 2 - Warm colors
  { value: '#EF4444', label: 'Červená' },
  { value: '#F97316', label: 'Oranžová' },
  { value: '#F59E0B', label: 'Žlutá' },
  { value: '#EAB308', label: 'Zlatá' },
  { value: '#84CC16', label: 'Limetka' },
  { value: '#22C55E', label: 'Zelená' },
  // Row 3 - Cool colors
  { value: '#10B981', label: 'Smaragdová' },
  { value: '#14B8A6', label: 'Tyrkysová' },
  { value: '#06B6D4', label: 'Azurová' },
  { value: '#3B82F6', label: 'Modrá' },
  { value: '#6366F1', label: 'Indigová' },
  { value: '#8B5CF6', label: 'Fialová' },
  // Row 4 - Pastels & Special
  { value: '#A855F7', label: 'Purpurová' },
  { value: '#EC4899', label: 'Růžová' },
  { value: '#F43F5E', label: 'Malinová' },
  { value: '#78350F', label: 'Hnědá' },
  { value: '#FFFFFF', label: 'Bílá' },
  { value: '#1E40AF', label: 'Královská modrá' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  backgroundColor: '#334155',
  border: '1px solid #475569',
  borderRadius: '6px',
  color: '#E5E5E5',
  fontSize: '12px',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 500,
  color: '#808080',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const buttonStyle: React.CSSProperties = {
  padding: '6px 10px',
  backgroundColor: '#334155',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 500,
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'all 0.1s ease',
};

// Typography presets
const TEXT_PRESETS = [
  { 
    id: 'h1', 
    label: 'Nadpis H1', 
    styles: { fontSize: 32, fontWeight: 'bold', lineHeight: 1.2, fontFamily: "'Fenomen Sans', sans-serif" } 
  },
  { 
    id: 'h2', 
    label: 'Podnadpis H2', 
    styles: { fontSize: 24, fontWeight: '600', lineHeight: 1.3, fontFamily: "'Fenomen Sans', sans-serif" } 
  },
  { 
    id: 'text', 
    label: 'Text', 
    styles: { fontSize: 12, fontWeight: 'normal', lineHeight: 1.5, fontFamily: "'Fenomen Sans', sans-serif" } 
  },
  { 
    id: 'caption', 
    label: 'Popisek', 
    styles: { fontSize: 10, fontWeight: 'normal', lineHeight: 1.4, fontFamily: "'Fenomen Sans', sans-serif", italic: true } 
  },
];
  
  // Visual style presets
  const STYLE_PRESETS = [
    { 
      id: 'none', 
      label: 'Žádný',
      styles: { backgroundColor: undefined, borderColor: undefined, borderWidth: undefined, borderStyle: undefined, borderRadius: undefined, shadow: undefined }
    },
    { 
      id: 'border', 
      label: 'Rámeček',
      styles: { backgroundColor: undefined, borderColor: '#374151', borderWidth: 1, borderStyle: 'solid' as const, borderRadius: 8, shadow: undefined }
    },
    { 
      id: 'card', 
      label: 'Karta',
      styles: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderWidth: 1, borderStyle: 'solid' as const, borderRadius: 12, shadow: 'medium' as const }
    },
    { 
      id: 'highlight', 
      label: 'Zvýraznění',
      styles: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2, borderStyle: 'dashed' as const, borderRadius: 8, shadow: undefined }
    },
    { 
      id: 'info', 
      label: 'Info',
      styles: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6', borderWidth: 2, borderStyle: 'solid' as const, borderRadius: 8, shadow: undefined }
    },
  ];

export function ProBlockSettingsPanel({
  block,
  onClose,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  gridColumns = 12,
}: ProBlockSettingsPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showBorderColorPicker, setShowBorderColorPicker] = useState(false);
  const [showCircleColorPicker, setShowCircleColorPicker] = useState(false);
  const [showCustomStyles, setShowCustomStyles] = useState(false);
  const [showVisualAdvanced, setShowVisualAdvanced] = useState(false);
  
  // Refs for inputs to handle formatting
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const optionInputRefs = useRef<Record<number, HTMLInputElement>>({});

  // Determine current preset
  const getCurrentPreset = () => {
    const vs = block.visualStyles;
    if (!vs || (!vs.backgroundColor && !vs.borderColor && !vs.shadow)) return 'none';
    for (const preset of STYLE_PRESETS) {
      if (preset.id === 'none') continue;
      const ps = preset.styles;
      if (vs.backgroundColor === ps.backgroundColor && 
          vs.borderColor === ps.borderColor && 
          vs.borderWidth === ps.borderWidth &&
          vs.borderRadius === ps.borderRadius &&
          vs.shadow === ps.shadow) {
        return preset.id;
      }
    }
    return 'custom';
  };

  const currentPreset = getCurrentPreset();
  
  const Icon = BLOCK_ICONS[block.type] || Type;
  const label = BLOCK_LABELS[block.type] || block.type;

  const renderTypeSpecificSettings = () => {
    switch (block.type) {
      case 'heading': {
        const headingBlock = block as HeadingBlock;
        return (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Úroveň</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3].map((level) => (
                  <button
                    key={level}
                    onClick={() => onUpdateBlock(block.id, {
                      content: { ...headingBlock.content, level: `h${level}` as any }
                    } as Partial<HeadingBlock>)}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      justifyContent: 'center',
                      backgroundColor: headingBlock.content.level === `h${level}` ? '#5C5CFF' : '#334155',
                      color: headingBlock.content.level === `h${level}` ? 'white' : '#94a3b8',
                    }}
                  >
                    H{level}
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      }

      case 'paragraph': {
        return null;
      }

      case 'infobox': {
        const infoboxBlock = block as InfoboxBlock;
        return (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Varianta</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {INFOBOX_VARIANTS.map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={() => onUpdateBlock(block.id, {
                      content: { ...infoboxBlock.content, variant: value }
                    } as Partial<InfoboxBlock>)}
                    style={{
                      ...buttonStyle,
                      backgroundColor: infoboxBlock.content.variant === value ? color : '#334155',
                      color: infoboxBlock.content.variant === value ? 'white' : '#94a3b8',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Titulek</label>
              <input
                type="text"
                value={infoboxBlock.content.title || ''}
                onChange={(e) => onUpdateBlock(block.id, {
                  content: { ...infoboxBlock.content, title: e.target.value }
                } as Partial<InfoboxBlock>)}
                placeholder="Titulek infoboxu..."
                style={inputStyle}
              />
            </div>
          </>
        );
      }

      case 'spacer': {
        const spacerBlock = block as SpacerBlock;
        return (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Výška (px)</label>
              <input
                type="number"
                value={spacerBlock.content.height || 100}
                onChange={(e) => onUpdateBlock(block.id, {
                  content: { ...spacerBlock.content, height: parseInt(e.target.value) || 100 }
                } as Partial<SpacerBlock>)}
                min={10}
                max={500}
                style={{ ...inputStyle, width: '100px' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Styl</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {SPACER_STYLES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => onUpdateBlock(block.id, {
                      content: { ...spacerBlock.content, style: value }
                    } as Partial<SpacerBlock>)}
                    style={{
                      ...buttonStyle,
                      backgroundColor: spacerBlock.content.style === value ? '#5C5CFF' : '#334155',
                      color: spacerBlock.content.style === value ? 'white' : '#94a3b8',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e293b',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: '#5C5CFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color: 'white' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#E5E5E5', margin: 0 }}>
            {label}
          </h3>
          <p style={{ fontSize: '10px', color: '#808080', margin: 0 }}>
            Nastavení bloku
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: '#808080',
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Actions */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        gap: '8px',
        flexShrink: 0,
        backgroundColor: '#1e293b',
      }}>
        <button
          onClick={() => onMoveUp?.(block.id)}
          disabled={!canMoveUp}
          style={{
            ...buttonStyle,
            backgroundColor: '#F97316',
            color: 'white',
            opacity: canMoveUp ? 1 : 0.4,
            cursor: canMoveUp ? 'pointer' : 'not-allowed',
          }}
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => onMoveDown?.(block.id)}
          disabled={!canMoveDown}
          style={{
            ...buttonStyle,
            backgroundColor: '#F97316',
            color: 'white',
            opacity: canMoveDown ? 1 : 0.4,
            cursor: canMoveDown ? 'pointer' : 'not-allowed',
          }}
        >
          <ChevronDown size={14} />
        </button>
        <button
          onClick={() => onDuplicateBlock(block.id)}
          style={buttonStyle}
        >
          <Copy size={14} />
          Duplikovat
        </button>
        <div style={{ flex: 1 }} />
        {confirmDelete ? (
          <>
            <button
              onClick={() => setConfirmDelete(false)}
              style={buttonStyle}
            >
              Zrušit
            </button>
            <button
              onClick={() => {
                onDeleteBlock(block.id);
                onClose();
              }}
              style={{
                ...buttonStyle,
                backgroundColor: '#EF4444',
                color: 'white',
              }}
            >
              Potvrdit
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              ...buttonStyle,
              color: '#EF4444',
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
        {/* ABC Question specific settings - SEPARATED FROM TEXT SECTION */}
        {block.type === 'multiple-choice' && (
          <div style={{ 
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
          }}>
        <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Typ odpovědí</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                {[
                  { value: 'text', label: 'ABC text' },
                  { value: 'mixed', label: 'ABC text + obr.' },
                  { value: 'image', label: 'ABC obrázky' },
                  { value: 'boolean', label: 'Ano / Ne' },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => {
                      const mcBlock = block as MultipleChoiceBlock;
                      onUpdateBlock(block.id, {
                        content: { ...mcBlock.content, variant: type.value as any }
                      } as Partial<MultipleChoiceBlock>);
                    }}
                    style={{
                      ...buttonStyle,
                      justifyContent: 'center',
                      backgroundColor: ((block as MultipleChoiceBlock).content.variant || 'text') === type.value ? '#5C5CFF' : '#334155',
                      color: ((block as MultipleChoiceBlock).content.variant || 'text') === type.value ? 'white' : '#94a3b8',
                      fontSize: '10px',
                      padding: '6px 2px',
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout options for text variant */}
            {((block as MultipleChoiceBlock).content.variant || 'text') === 'text' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Rozložení odpovědí</label>
          <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { value: 1, label: 'Pod sebou' },
                    { value: 2, label: '2 sloupce' },
                    { value: 4, label: 'V řádku' },
                  ].map((layout) => (
              <button
                      key={layout.value}
                      onClick={() => onUpdateBlock(block.id, {
                        content: { ...(block as MultipleChoiceBlock).content, gridColumns: layout.value }
                      } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                        backgroundColor: ((block as MultipleChoiceBlock).content.gridColumns || 1) === layout.value ? '#5C5CFF' : '#334155',
                        color: ((block as MultipleChoiceBlock).content.gridColumns || 1) === layout.value ? 'white' : '#94a3b8',
                        fontSize: '10px',
                }}
              >
                      {layout.label}
              </button>
            ))}
          </div>
        </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>MOŽNOSTI ODPOVĚDÍ</span>
            </div>

            {((block as MultipleChoiceBlock).content.variant === 'boolean') ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Ano', 'Ne'].map((label, idx) => {
                  const mcBlock = block as MultipleChoiceBlock;
                  const optionId = `opt-bool-${idx}`;
                  const isCorrect = mcBlock.content.correctAnswers.includes(optionId);
                  
                  // Ensure boolean options exist
                  if (!mcBlock.content.options.find(o => o.id === optionId)) {
                    const newOptions = [...mcBlock.content.options];
                    if (!newOptions.find(o => o.id === optionId)) {
                      newOptions.push({ id: optionId, text: label });
                      onUpdateBlock(block.id, { content: { ...mcBlock.content, options: newOptions } } as any);
                    }
                  }

                  return (
                    <div key={optionId} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <div style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: '#334155',
                        borderRadius: '6px',
                        color: '#E5E5E5',
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {label}
                      </div>
                      <button
                        onClick={() => {
                          onUpdateBlock(block.id, {
                            content: { ...mcBlock.content, correctAnswers: [optionId] }
                          } as any);
                        }}
                        style={{
                          ...buttonStyle,
                          width: '32px',
                          height: '32px',
                          padding: 0,
                          justifyContent: 'center',
                          backgroundColor: isCorrect ? '#10B981' : '#334155',
                          color: isCorrect ? 'white' : '#94a3b8',
                        }}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {((block as MultipleChoiceBlock).content.variant === 'image' || (block as MultipleChoiceBlock).content.variant === 'mixed') && (
                  <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Velikost obrázků</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { value: 2, label: 'Malé' },
                          { value: 3, label: 'Střední' },
                          { value: 4, label: 'Velké' },
                          { value: 6, label: 'Max' },
                        ].map((size) => (
                          <button
                            key={size.value}
                            onClick={() => onUpdateBlock(block.id, {
                              content: { ...(block as MultipleChoiceBlock).content, gridColumns: 12 / size.value }
                            } as any)}
                            style={{
                              ...buttonStyle,
                              flex: 1,
                              justifyContent: 'center',
                              backgroundColor: ((block as MultipleChoiceBlock).content.gridColumns === 12 / size.value) ? '#5C5CFF' : '#334155',
                              color: ((block as MultipleChoiceBlock).content.gridColumns === 12 / size.value) ? 'white' : '#94a3b8',
                            }}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Show letter position for both image and mixed mode */}
                    {((block as MultipleChoiceBlock).content.variant === 'image' || (block as MultipleChoiceBlock).content.variant === 'mixed') && (
                      <div>
                        <label style={labelStyle}>Pozice písmen</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[
                            { value: 'bottom', label: 'Pod obrázkem' },
                            { value: 'overlay', label: 'V rohu' },
                          ].map((pos) => (
                            <button
                              key={pos.value}
                              onClick={() => onUpdateBlock(block.id, {
                                content: { ...(block as MultipleChoiceBlock).content, letterPosition: pos.value as any }
                              } as any)}
                              style={{
                                ...buttonStyle,
                                flex: 1,
                                justifyContent: 'center',
                                backgroundColor: ((block as MultipleChoiceBlock).content.letterPosition || 'bottom') === pos.value ? '#5C5CFF' : '#334155',
                                color: ((block as MultipleChoiceBlock).content.letterPosition || 'bottom') === pos.value ? 'white' : '#94a3b8',
                              }}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {((block as MultipleChoiceBlock).content.options || []).map((option, idx) => (
                  <div key={option.id} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      backgroundColor: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#808080',
                      flexShrink: 0,
                      marginTop: '4px',
                    }}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {((block as MultipleChoiceBlock).content.variant !== 'image') && (
                        <input
                          type="text"
                          value={option.text}
                          onChange={(e) => {
                            const mcBlock = block as MultipleChoiceBlock;
                            const newOptions = [...(mcBlock.content.options || [])];
                            newOptions[idx] = { ...option, text: e.target.value };
                            onUpdateBlock(block.id, {
                              content: { ...mcBlock.content, options: newOptions }
                            } as Partial<MultipleChoiceBlock>);
                          }}
                          placeholder={`Možnost ${String.fromCharCode(65 + idx)}`}
                          style={{ ...inputStyle, width: '100%' }}
                        />
                      )}
                      {((block as MultipleChoiceBlock).content.variant === 'mixed' || (block as MultipleChoiceBlock).content.variant === 'image') && (
                        <div 
                          style={{ 
                            height: (block as MultipleChoiceBlock).content.variant === 'image' ? '80px' : '40px', 
                            backgroundColor: '#0f172a', 
                            borderRadius: '4px', 
                            border: '1px dashed #475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            overflow: 'hidden'
                          }}
                          onClick={() => {
                            const url = prompt('Vložte URL obrázku:');
                            if (url) {
                              const mcBlock = block as MultipleChoiceBlock;
                              const newOptions = [...(mcBlock.content.options || [])];
                              newOptions[idx] = { ...option, imageUrl: url };
                              onUpdateBlock(block.id, {
                                content: { ...mcBlock.content, options: newOptions }
                              } as Partial<MultipleChoiceBlock>);
                            }
                          }}
                        >
                          {option.imageUrl ? (
                            <img src={option.imageUrl} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <ImageIcon size={14} style={{ color: '#64748b' }} />
                              {(block as MultipleChoiceBlock).content.variant === 'image' && <span style={{ fontSize: '9px', color: '#475569' }}>Vložit obrázek</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const mcBlock = block as MultipleChoiceBlock;
                        const newCorrect = mcBlock.content.correctAnswers.includes(option.id)
                          ? mcBlock.content.correctAnswers.filter(id => id !== option.id)
                          : [...mcBlock.content.correctAnswers, option.id];
                        onUpdateBlock(block.id, {
                          content: { ...mcBlock.content, correctAnswers: newCorrect }
                        } as Partial<MultipleChoiceBlock>);
                      }}
                      style={{
                        ...buttonStyle,
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        justifyContent: 'center',
                        backgroundColor: (block as MultipleChoiceBlock).content.correctAnswers.includes(option.id) ? '#10B981' : '#334155',
                        color: (block as MultipleChoiceBlock).content.correctAnswers.includes(option.id) ? 'white' : '#94a3b8',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => {
                        const mcBlock = block as MultipleChoiceBlock;
                        const newOptions = (mcBlock.content.options || []).filter(o => o.id !== option.id);
                        const newCorrect = mcBlock.content.correctAnswers.filter(id => id !== option.id);
                        onUpdateBlock(block.id, {
                          content: { ...mcBlock.content, options: newOptions, correctAnswers: newCorrect }
                        } as Partial<MultipleChoiceBlock>);
                      }}
                      style={{
                        ...buttonStyle,
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        justifyContent: 'center',
                        color: '#EF4444',
                        backgroundColor: 'transparent',
                        flexShrink: 0,
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={() => {
                    const mcBlock = block as MultipleChoiceBlock;
                    const newOptions = [...(mcBlock.content.options || [])];
                    const nextLetter = String.fromCharCode(65 + newOptions.length);
                    newOptions.push({ id: `opt-${Date.now()}`, text: `Možnost ${nextLetter}` });
                    onUpdateBlock(block.id, {
                      content: { ...mcBlock.content, options: newOptions }
                    } as Partial<MultipleChoiceBlock>);
                  }}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    marginTop: '8px',
                    justifyContent: 'center',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                  }}
                >
                  <Plus size={14} />
                  Přidat možnost
                </button>
              </>
            )}
          </div>
        )}

        {/* TEXT Section - for text blocks */}
        {['heading', 'paragraph', 'infobox', 'fill-blank', 'free-answer', 'multiple-choice', 'free-canvas'].includes(block.type) && (
          <div style={{ 
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>TEXT</span>
              <LayoutGrid size={14} style={{ color: '#808080' }} />
            </div>

            {/* Presets Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), ...preset.styles }
                  } as any)}
                  style={{
                    ...buttonStyle,
                    flex: '1 1 auto',
                    justifyContent: 'center',
                    fontSize: '10px',
                    padding: '4px 8px',
                    backgroundColor: '#334155',
                  }}
                >
                  {preset.label}
                </button>
              ))}
              <button
                onClick={() => {
                  const name = prompt('Název stylu:');
                  if (name) {
                    toast.success(`Styl "${name}" byl uložen do konfigurace.`);
                  }
                }}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#334155',
                  padding: '4px',
                }}
                title="Uložit konfiguraci"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Question/Instruction Textarea */}
            {(block.type === 'multiple-choice' || block.type === 'free-canvas') && (
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>{block.type === 'free-canvas' ? 'Zadání' : 'Otázka'}</label>
                <textarea
                  ref={questionInputRef}
                  value={(block.content as any).question || ''}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    onUpdateBlock(block.id, {
                      content: { ...block.content, question: newValue }
                    });
                  }}
                  placeholder={block.type === 'free-canvas' ? "Zadejte zadání aktivity..." : "Zadejte otázku..."}
                  style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
                />
              </div>
            )}

            {/* Canvas Insert Tools */}
            {block.type === 'free-canvas' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...labelStyle, marginBottom: '10px', display: 'block' }}>VLOŽIT</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { icon: '▢', label: 'Obdélník', type: 'rectangle' },
                    { icon: '○', label: 'Kruh', type: 'ellipse' },
                    { icon: 'T', label: 'Text', type: 'text' },
                    { icon: '🖼', label: 'Obrázek', type: 'image' },
                  ].map((tool) => (
                    <button
                      key={tool.type}
                      onClick={() => {
                        const canvasContent = block.content as any;
                        const newObject: any = {
                          id: `obj-${Date.now()}`,
                          type: tool.type,
                          x: 50 + Math.random() * 100,
                          y: 50 + Math.random() * 100,
                          width: tool.type === 'text' ? 150 : 100,
                          height: tool.type === 'text' ? 40 : 100,
                          zIndex: (canvasContent.objects?.length || 0) + 1,
                          locked: false,
                          ...(tool.type === 'rectangle' && { fill: '#3B82F6', stroke: '', strokeWidth: 2, borderRadius: 0 }),
                          ...(tool.type === 'ellipse' && { fill: '#10B981', stroke: '', strokeWidth: 2 }),
                          ...(tool.type === 'text' && { text: 'Text', fontSize: 16, fontFamily: 'inherit', fill: '#000000', bold: false, italic: false, align: 'left' }),
                          ...(tool.type === 'image' && { url: '', alt: '', objectFit: 'contain' }),
                        };
                        onUpdateBlock(block.id, {
                          content: {
                            ...canvasContent,
                            objects: [...(canvasContent.objects || []), newObject],
                          }
                        });
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '12px 8px',
                        backgroundColor: '#334155',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#475569';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#334155';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{tool.icon}</span>
                      <span style={{ fontSize: '10px', color: '#A0A0A0' }}>{tool.label}</span>
                    </button>
                  ))}
                </div>

                {/* Canvas Settings */}
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#808080', flex: 1 }}>Výška plátna</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => {
                          const canvasContent = block.content as any;
                          onUpdateBlock(block.id, {
                            content: { ...canvasContent, canvasHeight: Math.max(100, (canvasContent.canvasHeight || 400) - 50) }
                          });
                        }}
                        style={{ ...buttonStyle, width: 24, height: 24, padding: 0 }}
                      >−</button>
                      <span style={{ fontSize: '12px', color: '#E5E5E5', minWidth: '50px', textAlign: 'center' }}>
                        {(block.content as any).canvasHeight || 400}px
                      </span>
                      <button
                        onClick={() => {
                          const canvasContent = block.content as any;
                          onUpdateBlock(block.id, {
                            content: { ...canvasContent, canvasHeight: Math.min(800, (canvasContent.canvasHeight || 400) + 50) }
                          });
                        }}
                        style={{ ...buttonStyle, width: 24, height: 24, padding: 0 }}
                      >+</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#808080', flex: 1 }}>Pozadí plátna</span>
                    <input
                      type="color"
                      value={(block.content as any).backgroundColor || '#ffffff'}
                      onChange={(e) => {
                        onUpdateBlock(block.id, {
                          content: { ...block.content, backgroundColor: e.target.value }
                        });
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        padding: 0,
                        border: '2px solid #475569',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fill / Text Color Row */}
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  backgroundColor: '#334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: (block.content as any)?.textColor || '#000000',
                    borderRadius: '50%',
                    border: (block.content as any)?.textColor === '#FFFFFF' ? '1px solid #475569' : 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
                <span style={{ fontSize: '12px', color: '#E5E5E5', flex: 1 }}>
                  {TEXT_COLORS.find(c => c.value === (block.content as any)?.textColor)?.label || 'Vlastní barva'}
                </span>
                <ChevronDownIcon 
                  size={14} 
                  style={{ 
                    color: '#808080',
                    transform: showColorPicker ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }} 
                />
              </div>
              
              {/* Color Picker Dropdown */}
              {showColorPicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    padding: '12px',
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    zIndex: 1000,
                  }}
                >
                  {/* Preset Colors Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '8px',
                    marginBottom: '12px',
                  }}>
                    {TEXT_COLORS.map((color) => (
                      <div
                        key={color.value}
                        title={color.label}
                        onClick={() => {
                          onUpdateBlock(block.id, {
                            content: { ...(block.content as any), textColor: color.value }
                          } as any);
                          setShowColorPicker(false);
                        }}
                        style={{
                          width: '28px',
                          height: '28px',
                          backgroundColor: color.value,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          border: (block.content as any)?.textColor === color.value 
                            ? '2px solid #5C5CFF' 
                            : color.value === '#FFFFFF' 
                              ? '1px solid #475569' 
                              : 'none',
                          boxShadow: (block.content as any)?.textColor === color.value 
                            ? '0 0 0 2px rgba(92, 92, 255, 0.3)' 
                            : '0 1px 3px rgba(0,0,0,0.3)',
                          transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Circle/Number Styles for Multiple Choice or Free Canvas */}
            {(block.type === 'multiple-choice' || block.type === 'free-canvas') && (
              <div style={{ 
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #333',
              }}>
                <label style={{ ...labelStyle, marginBottom: '8px', display: 'block' }}>KROUŽEK A ČÍSLO</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Circle Color Picker */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        backgroundColor: '#334155',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowCircleColorPicker(!showCircleColorPicker)}
                    >
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          backgroundColor: (block.content as any)?.circleColor || '#1e293b',
                          borderRadius: '50%',
                          border: '1px solid #475569',
                        }}
                      />
                      <span style={{ fontSize: '11px', color: '#E5E5E5' }}>Barva</span>
                    </div>
                    
                    {showCircleColorPicker && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '4px',
                          padding: '8px',
                          backgroundColor: '#1e293b',
                          borderRadius: '8px',
                          border: '1px solid #334155',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(5, 1fr)',
                          gap: '4px',
                          zIndex: 1000,
                        }}
                      >
                        {TEXT_COLORS.map((color) => (
                          <div
                            key={color.value}
                            onClick={() => {
                              onUpdateBlock(block.id, {
                                content: { ...(block.content as any), circleColor: color.value }
                              } as any);
                              setShowCircleColorPicker(false);
                            }}
                            style={{
                              width: '20px',
                              height: '20px',
                              backgroundColor: color.value,
                              borderRadius: '50%',
                              cursor: 'pointer',
                              border: (block.content as any)?.circleColor === color.value ? '2px solid #5C5CFF' : 'none',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Circle Size Slider */}
                  <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#808080' }}>Velikost</span>
                    <input
                      type="range"
                      min="16"
                      max="32"
                      value={(block.content as any)?.circleSize || 21}
                      onChange={(e) => onUpdateBlock(block.id, {
                        content: { ...(block.content as any), circleSize: parseInt(e.target.value) }
                      } as any)}
                      style={{ flex: 1, height: '4px' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Collapsible Advanced Settings */}
            <div 
              style={{
                borderTop: '1px solid #333',
                paddingTop: '8px',
                marginTop: '8px',
              }}
            >
              <button
                onClick={() => setShowCustomStyles(!showCustomStyles)}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  justifyContent: 'space-between',
                  backgroundColor: 'transparent',
                  padding: '4px 0',
                }}
              >
                <span style={{ fontSize: '10px', color: '#808080' }}>DALŠÍ NASTAVENÍ</span>
                <ChevronDownIcon size={12} style={{ transform: showCustomStyles ? 'rotate(180deg)' : 'none' }} />
              </button>

              {showCustomStyles && (
                <div style={{ marginTop: '12px' }}>
            {/* Font Family */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ position: 'relative' }}>
                <select
                  value={(block.content as any)?.fontFamily || "'Fenomen Sans', sans-serif"}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontFamily: e.target.value }
                  } as any)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    paddingRight: '28px',
                    cursor: 'pointer',
                  }}
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font.value} value={font.value}>{font.label}</option>
                  ))}
                </select>
                <ChevronDownIcon size={14} style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#808080',
                }} />
              </div>
            </div>

            {/* Font Size and Weight Row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {/* Font Weight */}
              <div style={{ flex: 1, position: 'relative' }}>
                <select
                  value={(block.content as any)?.fontWeight || 'normal'}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontWeight: e.target.value }
                  } as any)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    paddingRight: '28px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="normal">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="bold">Bold</option>
                </select>
                <ChevronDownIcon size={14} style={{ 
                  position: 'absolute', 
                  right: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#808080',
                }} />
              </div>

              {/* Font Size */}
              <div style={{ width: '70px', position: 'relative' }}>
                <select
                  value={(block.content as any)?.fontSize || 12}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), fontSize: parseInt(e.target.value) }
                  } as any)}
                  style={{
                    ...inputStyle,
                    appearance: 'none',
                    paddingRight: '24px',
                    cursor: 'pointer',
                  }}
                >
                  {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <ChevronDownIcon size={14} style={{ 
                  position: 'absolute', 
                  right: '8px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#808080',
                }} />
              </div>
            </div>

            {/* Line Height and Letter Spacing */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, marginBottom: '2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>A</span>
                    <span style={{ fontSize: '10px' }}>{(block.content as any)?.lineHeight || 1.5}</span>
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.1"
                  value={(block.content as any)?.lineHeight || 1.5}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), lineHeight: parseFloat(e.target.value) }
                  } as any)}
                  style={{
                    width: '100%',
                    height: '4px',
                    appearance: 'none',
                    backgroundColor: '#475569',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, marginBottom: '2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px' }}>|A|</span>
                    <span style={{ fontSize: '10px' }}>{(block.content as any)?.letterSpacing || 0}%</span>
                  </span>
                </label>
                <input
                  type="range"
                  min="-5"
                  max="20"
                  step="1"
                  value={(block.content as any)?.letterSpacing || 0}
                  onChange={(e) => onUpdateBlock(block.id, {
                    content: { ...(block.content as any), letterSpacing: parseInt(e.target.value) }
                  } as any)}
                  style={{
                    width: '100%',
                    height: '4px',
                    appearance: 'none',
                    backgroundColor: '#475569',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            {/* Text Alignment - Horizontal */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), align: 'left' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: ((block.content as any)?.align || 'left') === 'left' ? '#5C5CFF' : '#334155',
                  color: ((block.content as any)?.align || 'left') === 'left' ? 'white' : '#94a3b8',
                }}
              >
                <AlignLeft size={14} />
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), align: 'center' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.align === 'center' ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.align === 'center' ? 'white' : '#94a3b8',
                }}
              >
                <AlignCenter size={14} />
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), align: 'right' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.align === 'right' ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.align === 'right' ? 'white' : '#94a3b8',
                }}
              >
                <AlignRight size={14} />
              </button>

              {/* Separator */}
              <div style={{ width: '1px', backgroundColor: '#475569', margin: '0 4px' }} />

              {/* Text Alignment - Vertical */}
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), verticalAlign: 'top' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: ((block.content as any)?.verticalAlign || 'top') === 'top' ? '#5C5CFF' : '#334155',
                  color: ((block.content as any)?.verticalAlign || 'top') === 'top' ? 'white' : '#94a3b8',
                }}
                title="Zarovnat nahoru"
              >
                <ArrowUpToLine size={14} />
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), verticalAlign: 'center' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.verticalAlign === 'center' ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.verticalAlign === 'center' ? 'white' : '#94a3b8',
                }}
                title="Zarovnat na střed"
              >
                <AlignVerticalJustifyCenter size={14} />
              </button>
              <button
                onClick={() => onUpdateBlock(block.id, {
                  content: { ...(block.content as any), verticalAlign: 'bottom' }
                } as any)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.verticalAlign === 'bottom' ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.verticalAlign === 'bottom' ? 'white' : '#94a3b8',
                }}
                title="Zarovnat dolů"
              >
                <ArrowDownToLine size={14} />
              </button>
            </div>

            {/* Text Style Toggles */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => {
                        const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
                        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                          const start = activeEl.selectionStart || 0;
                          const end = activeEl.selectionEnd || 0;
                          const text = activeEl.value;
                          const selectedText = text.substring(start, end);
                          
                          if (selectedText) {
                            const formattedText = `**${selectedText}**`;
                            const newValue = text.substring(0, start) + formattedText + text.substring(end);
                            
                            activeEl.value = newValue;
                            
                            if (block.type === 'multiple-choice') {
                              const mcBlock = block as MultipleChoiceBlock;
                              
                              // Check if we are in an option input
                              const optionIndex = mcBlock.content.options.findIndex(opt => opt.text === text);
                              
                              if (optionIndex !== -1) {
                                const newOptions = [...mcBlock.content.options];
                                newOptions[optionIndex] = { ...newOptions[optionIndex], text: newValue };
                                onUpdateBlock(block.id, {
                                  content: { ...mcBlock.content, options: newOptions }
                                } as any);
                              } else {
                                // Must be the question
                                onUpdateBlock(block.id, {
                                  content: { ...mcBlock.content, question: newValue }
                                } as any);
                              }
                            } else {
                              onUpdateBlock(block.id, {
                                content: { ...(block.content as any), text: newValue }
                              } as any);
                            }

                            setTimeout(() => {
                              activeEl.focus();
                              activeEl.setSelectionRange(start, start + formattedText.length);
                            }, 10);
                            return;
                          }
                        }
                        
                        onUpdateBlock(block.id, {
                          content: { ...(block.content as any), isBold: !(block.content as any)?.isBold }
                        } as any);
                      }}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.isBold ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.isBold ? 'white' : '#94a3b8',
                }}
              >
                <Bold size={14} />
              </button>
              <button
                      onClick={() => {
                        const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
                        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                          const start = activeEl.selectionStart || 0;
                          const end = activeEl.selectionEnd || 0;
                          const text = activeEl.value;
                          const selectedText = text.substring(start, end);
                          
                          if (selectedText) {
                            const formattedText = `*${selectedText}*`;
                            const newValue = text.substring(0, start) + formattedText + text.substring(end);
                            
                            activeEl.value = newValue;
                            
                            if (block.type === 'multiple-choice') {
                              const mcBlock = block as MultipleChoiceBlock;
                              const optionIndex = mcBlock.content.options.findIndex(opt => opt.text === text);
                              
                              if (optionIndex !== -1) {
                                const newOptions = [...mcBlock.content.options];
                                newOptions[optionIndex] = { ...newOptions[optionIndex], text: newValue };
                                onUpdateBlock(block.id, {
                                  content: { ...mcBlock.content, options: newOptions }
                                } as any);
                              } else {
                                onUpdateBlock(block.id, {
                                  content: { ...mcBlock.content, question: newValue }
                                } as any);
                              }
                            } else {
                              onUpdateBlock(block.id, {
                                content: { ...(block.content as any), text: newValue }
                              } as any);
                            }

                            setTimeout(() => {
                              activeEl.focus();
                              activeEl.setSelectionRange(start, start + formattedText.length);
                            }, 10);
                            return;
                          }
                        }
                        onUpdateBlock(block.id, {
                  content: { ...(block.content as any), isItalic: !(block.content as any)?.isItalic }
                        } as any);
                      }}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.isItalic ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.isItalic ? 'white' : '#94a3b8',
                }}
              >
                <Italic size={14} />
              </button>
              <button
                      onClick={() => {
                        const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
                        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                          const start = activeEl.selectionStart || 0;
                          const end = activeEl.selectionEnd || 0;
                          const text = activeEl.value;
                          const selectedText = text.substring(start, end);
                          
                          if (selectedText) {
                            const formattedText = `<u>${selectedText}</u>`;
                            const newValue = text.substring(0, start) + formattedText + text.substring(end);
                            
                            activeEl.value = newValue;
                            
                            if (block.type === 'multiple-choice') {
                              const mcBlock = block as MultipleChoiceBlock;
                              const optionIndex = mcBlock.content.options.findIndex(opt => opt.text === text);
                              
                              if (optionIndex !== -1) {
                                const newOptions = [...mcBlock.content.options];
                                newOptions[optionIndex] = { ...newOptions[optionIndex], text: newValue };
                                onUpdateBlock(block.id, {
                                  content: { ...mcBlock.content, options: newOptions }
                                } as any);
                              } else {
                                onUpdateBlock(block.id, {
                                  content: { ...mcBlock.content, question: newValue }
                                } as any);
                              }
                            } else {
                              onUpdateBlock(block.id, {
                                content: { ...(block.content as any), text: newValue }
                              } as any);
                            }

                            setTimeout(() => {
                              activeEl.focus();
                              activeEl.setSelectionRange(start, start + formattedText.length);
                            }, 10);
                            return;
                          }
                        }
                        onUpdateBlock(block.id, {
                  content: { ...(block.content as any), isUnderline: !(block.content as any)?.isUnderline }
                        } as any);
                      }}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  backgroundColor: (block.content as any)?.isUnderline ? '#5C5CFF' : '#334155',
                  color: (block.content as any)?.isUnderline ? 'white' : '#94a3b8',
                }}
              >
                <Underline size={14} />
              </button>
            </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visual Styles Section */}
              <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #334155',
        }}>
          <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
            justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>VZHLED BLOKU</span>
            <button
                        onClick={() => {
                const name = prompt('Název vzhledu bloku:');
                if (name) {
                  toast.success(`Vzhled "${name}" byl uložen do knihovny.`);
                }
                        }}
                        style={{
                ...buttonStyle,
                backgroundColor: 'transparent',
                padding: '2px',
                color: '#808080',
              }}
              title="Uložit vzhled bloku"
            >
              <Plus size={14} />
            </button>
                  </div>
                  
          {/* Margin Style (Space below block) - MOVED UP */}
          {(block.marginBottom || 0) > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'empty', label: 'Prázdný', icon: null },
                  { value: 'dotted', label: 'Tečky', icon: 'dots' },
                  { value: 'lined', label: 'Linky', icon: 'lines' },
                ].map((styleOption) => (
                  <button
                    key={styleOption.value}
                    onClick={() => {
                        onUpdateBlock(block.id, {
                        marginStyle: styleOption.value as any,
                      });
                    }}
                    style={{
                      ...buttonStyle,
                      flex: 1,
                      flexDirection: 'column',
                      height: '42px',
                      justifyContent: 'center',
                      backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? '#3B82F6' : '#1e293b',
                      border: (block.marginStyle || 'empty') === styleOption.value ? '1px solid #60A5FA' : '1px solid #334155',
                      color: (block.marginStyle || 'empty') === styleOption.value ? 'white' : '#94a3b8',
                      padding: '4px',
                      gap: '0',
                    }}
                    title={styleOption.label}
                  >
                    {/* Texture Preview */}
                    <div style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '4px',
                      backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? 'rgba(255,255,255,0.2)' : '#0f172a',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: '3px',
                      padding: '6px',
                      overflow: 'hidden',
                    }}>
                      {styleOption.icon === 'dots' && (
                        <div style={{ 
                          height: '100%', 
                          backgroundImage: `radial-gradient(${(block.marginStyle || 'empty') === styleOption.value ? '#FFFFFF' : '#CCCCCC'} 1.5px, transparent 1.5px)`, 
                          backgroundSize: '6px 6px' 
                        }} />
                      )}
                      {styleOption.icon === 'lines' && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                          <div style={{ height: '1.5px', backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                          <div style={{ height: '1.5px', backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                          <div style={{ height: '1.5px', backgroundColor: (block.marginStyle || 'empty') === styleOption.value ? '#FFFFFF' : '#CCCCCC', width: '100%' }} />
                  </div>
                      )}
                      {styleOption.icon === null && (
                        <div style={{ height: '100%', border: '1px dashed #475569', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <X size={14} style={{ color: '#64748b', opacity: 0.5 }} />
                </div>
              )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

          {/* Style Presets Grid - Minimalist Squares */}
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(6, 1fr)', 
            gap: '6px',
            marginBottom: '16px' 
          }}>
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onUpdateBlock(block.id, { visualStyles: { ...block.visualStyles, ...preset.styles } });
                    setShowCustomStyles(false);
                  }}
                title={preset.label}
                  style={{
                    ...buttonStyle,
                    width: '100%',
                    aspectRatio: '1/1',
                    padding: '4px',
                    backgroundColor: '#1e293b',
                    border: currentPreset === preset.id ? '2px solid #5C5CFF' : '1px solid #334155',
                    borderRadius: '6px',
                    justifyContent: 'center',
                    position: 'relative',
                }}
              >
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: preset.styles.backgroundColor || '#334155',
                  border: preset.styles.borderColor ? `${preset.styles.borderWidth ? Math.min(2, preset.styles.borderWidth) : 1}px ${preset.styles.borderStyle || 'solid'} ${preset.styles.borderColor}` : 'none',
                  borderRadius: '3px',
                  boxShadow: preset.styles.shadow === 'medium' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
                }} />
                </button>
              ))}
            
            {/* Custom Style Button */}
              <button
              onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
              title="Vlastní nastavení"
                style={{
                  ...buttonStyle,
                width: '100%',
                aspectRatio: '1/1',
                padding: '4px',
                backgroundColor: '#1e293b',
                border: (currentPreset === 'custom' || showVisualAdvanced) ? '2px solid #5C5CFF' : '1px solid #334155',
                borderRadius: '6px',
                  justifyContent: 'center',
              }}
            >
              <div style={{
                width: '100%',
                height: '100%',
                border: '1px dashed #475569',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Palette size={12} style={{ color: '#808080' }} />
              </div>
              </button>
          </div>

          {/* Collapsible Advanced Visual Settings */}
          <div 
            style={{
              borderTop: '1px solid #333',
              paddingTop: '8px',
              marginTop: '8px',
            }}
          >
            <button
              onClick={() => setShowVisualAdvanced(!showVisualAdvanced)}
              style={{
                ...buttonStyle,
                width: '100%',
                justifyContent: 'space-between',
                backgroundColor: 'transparent',
                padding: '4px 0',
              }}
            >
              <span style={{ fontSize: '10px', color: '#808080' }}>DALŠÍ NASTAVENÍ</span>
              <ChevronDownIcon size={12} style={{ transform: (showVisualAdvanced || currentPreset === 'custom') ? 'rotate(180deg)' : 'none' }} />
            </button>

            {(showVisualAdvanced || currentPreset === 'custom') && (
              <div style={{ marginTop: '12px' }}>
              {/* ROW 1: Background & Border Colors */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  {/* Background Color */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Pozadí</span>
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 8px',
                        backgroundColor: '#334155',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setShowBgColorPicker(!showBgColorPicker)}
                    >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: block.visualStyles?.backgroundColor || 'transparent',
                      borderRadius: '50%',
                      border: '1px solid #475569',
                      flexShrink: 0,
                    }}
                  />
                  {block.visualStyles?.backgroundColor && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateBlock(block.id, {
                          visualStyles: { ...block.visualStyles, backgroundColor: undefined }
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#808080',
                        cursor: 'pointer',
                        padding: '0',
                        marginLeft: 'auto',
                      }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
                {/* Background Color Picker Dropdown */}
                {showBgColorPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      padding: '12px',
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      zIndex: 1000,
                      width: '200px',
                    }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: '6px',
                      marginBottom: '10px',
                    }}>
                      {TEXT_COLORS.map((color) => (
                        <div
                          key={color.value}
                          title={color.label}
                          onClick={() => {
                            onUpdateBlock(block.id, {
                              visualStyles: { ...block.visualStyles, backgroundColor: color.value }
                            });
                            setShowBgColorPicker(false);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: color.value,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            border: block.visualStyles?.backgroundColor === color.value 
                              ? '2px solid #5C5CFF' 
                              : color.value === '#FFFFFF' ? '1px solid #475569' : 'none',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      ))}
                    </div>
                    <div
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'color';
                        input.value = block.visualStyles?.backgroundColor || '#ffffff';
                        input.onchange = (e) => {
                          onUpdateBlock(block.id, {
                            visualStyles: { ...block.visualStyles, backgroundColor: (e.target as HTMLInputElement).value }
                          });
                          setShowBgColorPicker(false);
                        };
                        input.click();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '6px',
                        backgroundColor: '#334155',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        color: '#E5E5E5',
                      }}
                    >
                      <Palette size={12} />
                      Vlastní
                    </div>
                  </div>
                )}
              </div>

              {/* Border Color */}
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Ohraničení</span>
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    backgroundColor: '#334155',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowBorderColorPicker(!showBorderColorPicker)}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: 'transparent',
                      borderRadius: '50%',
                      border: `3px ${block.visualStyles?.borderStyle || 'solid'} ${block.visualStyles?.borderColor || '#475569'}`,
                      flexShrink: 0,
                    }}
                  />
                  {block.visualStyles?.borderColor && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateBlock(block.id, {
                          visualStyles: { ...block.visualStyles, borderColor: undefined, borderWidth: undefined, borderStyle: undefined }
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#808080',
                        cursor: 'pointer',
                        padding: '0',
                        marginLeft: 'auto',
                      }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
                {/* Border Color Picker Dropdown */}
                {showBorderColorPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      padding: '12px',
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      zIndex: 1000,
                      width: '200px',
                    }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: '6px',
                      marginBottom: '10px',
                    }}>
                      {TEXT_COLORS.map((color) => (
                        <div
                          key={color.value}
                          title={color.label}
                          onClick={() => {
                            onUpdateBlock(block.id, {
                              visualStyles: { 
                                ...block.visualStyles, 
                                borderColor: color.value,
                                borderWidth: block.visualStyles?.borderWidth || 2,
                                borderStyle: block.visualStyles?.borderStyle || 'solid',
                              }
                            });
                            setShowBorderColorPicker(false);
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            backgroundColor: color.value,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            border: block.visualStyles?.borderColor === color.value 
                              ? '2px solid #5C5CFF' 
                              : color.value === '#FFFFFF' ? '1px solid #475569' : 'none',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      ))}
                    </div>
                    <div
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'color';
                        input.value = block.visualStyles?.borderColor || '#000000';
                        input.onchange = (e) => {
                          onUpdateBlock(block.id, {
                            visualStyles: { 
                              ...block.visualStyles, 
                              borderColor: (e.target as HTMLInputElement).value,
                              borderWidth: block.visualStyles?.borderWidth || 2,
                              borderStyle: block.visualStyles?.borderStyle || 'solid',
                            }
                          });
                          setShowBorderColorPicker(false);
                        };
                        input.click();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '6px',
                        backgroundColor: '#334155',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        color: '#E5E5E5',
                      }}
                    >
                      <Palette size={12} />
                      Vlastní
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROW 2: Border Width, Style, and Border Radius - only show if border color is set */}
          {block.visualStyles?.borderColor && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {/* Border Width Dropdown */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Tloušťka</span>
                  <select
                    value={block.visualStyles?.borderWidth || 2}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderWidth: parseInt(e.target.value) }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 8].map((w) => (
                      <option key={w} value={w}>{w}px</option>
                    ))}
                  </select>
                </div>

                {/* Border Style */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Styl</span>
                  <select
                    value={block.visualStyles?.borderStyle || 'solid'}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderStyle: e.target.value as 'solid' | 'dashed' | 'dotted' }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="solid">Plná</option>
                    <option value="dashed">Přerušovaná</option>
                    <option value="dotted">Tečkovaná</option>
                  </select>
                </div>

                {/* Border Radius */}
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '4px' }}>Zaoblení</span>
                  <select
                    value={block.visualStyles?.borderRadius || 0}
                    onChange={(e) => onUpdateBlock(block.id, {
                      visualStyles: { ...block.visualStyles, borderRadius: parseInt(e.target.value) }
                    })}
                    style={{
                      width: '100%',
                      padding: '8px 6px',
                      backgroundColor: '#334155',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#E5E5E5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {[0, 4, 8, 12, 16, 24, 32].map((r) => (
                      <option key={r} value={r}>{r}px</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

              {/* Shadow */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#CCCCCC' }}>Stín</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['none', 'small', 'medium', 'large'] as const).map((shadowType) => (
                    <button
                      key={shadowType}
                      onClick={() => onUpdateBlock(block.id, {
                        visualStyles: { ...block.visualStyles, shadow: shadowType }
                      })}
                      style={{
                        ...buttonStyle,
                        flex: 1,
                        justifyContent: 'center',
                        backgroundColor: (block.visualStyles?.shadow || 'none') === shadowType ? '#5C5CFF' : '#334155',
                        color: (block.visualStyles?.shadow || 'none') === shadowType ? 'white' : '#94a3b8',
                        padding: '6px 4px',
                        fontSize: '10px',
                      }}
                    >
                      {shadowType === 'none' ? 'Žádný' : 
                       shadowType === 'small' ? 'S' : 
                       shadowType === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Padding with Visual Preview */}
              <div style={{ marginTop: '16px' }}>
                <span style={{ fontSize: '10px', color: '#808080', display: 'block', marginBottom: '8px' }}>Odsazení obsahu</span>
                
                {/* Visual Padding Preview */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  {/* Graphical box showing padding */}
                  <div style={{
                    width: '70px',
                    height: '50px',
                    backgroundColor: '#475569',
                    borderRadius: '6px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    {/* Padding visualization - outer colored area */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: '#5C5CFF',
                      opacity: 0.3,
                      transition: 'all 0.15s ease',
                    }} />
                    {/* Content area - the white inner box */}
                    <div style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '3px',
                      transition: 'all 0.15s ease',
                      width: `${Math.max(20, 100 - (block.padding || 0) * 1.5)}%`,
                      height: `${Math.max(20, 100 - (block.padding || 0) * 2)}%`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        width: '60%',
                        height: '3px',
                        backgroundColor: '#808080',
                        borderRadius: '2px',
                      }} />
                    </div>
                    {/* Padding value labels */}
                    {(block.padding || 0) > 0 && (
                      <>
                        <span style={{
                          position: 'absolute',
                          top: '1px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '7px',
                          color: '#A0A0FF',
                          fontWeight: 600,
                        }}>
                          {block.padding || 0}
                        </span>
                        <span style={{
                          position: 'absolute',
                          left: '1px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '7px',
                          color: '#A0A0FF',
                          fontWeight: 600,
                        }}>
                          {block.padding || 0}
                        </span>
                        <span style={{
                          position: 'absolute',
                          right: '1px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '7px',
                          color: '#A0A0FF',
                          fontWeight: 600,
                        }}>
                          {block.padding || 0}
                        </span>
                        <span style={{
                          position: 'absolute',
                          bottom: '1px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '7px',
                          color: '#A0A0FF',
                          fontWeight: 600,
                        }}>
                          {block.padding || 0}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Slider and value */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8' }}>Okraje</span>
                      <span style={{ fontSize: '10px', color: '#EEEEEE', fontWeight: 600 }}>
                        {block.padding || 0}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="48"
                      step="4"
                      value={block.padding || 0}
                      onChange={(e) => onUpdateBlock(block.id, { padding: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        height: '4px',
                        appearance: 'none',
                        backgroundColor: '#475569',
                        borderRadius: '2px',
                        cursor: 'pointer',
                      }}
                    />
                    {/* Quick preset buttons */}
                    <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
                      {[0, 8, 16, 24, 32, 48].map((val) => (
                        <button
                          key={val}
                          onClick={() => onUpdateBlock(block.id, { padding: val })}
                          style={{
                            ...buttonStyle,
                            flex: 1,
                            padding: '3px 1px',
                            fontSize: '8px',
                            backgroundColor: (block.padding || 0) === val ? '#5C5CFF' : '#334155',
                            color: (block.padding || 0) === val ? 'white' : '#94a3b8',
                            justifyContent: 'center',
                          }}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

                {/* Bottom Margin Slider (Advanced only) */}
                <div style={{ marginTop: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
                    <span style={{ fontSize: '10px', color: '#808080' }}>Výška prostoru pod blokem</span>
                    <span style={{ fontSize: '10px', color: '#CCCCCC' }}>{block.marginBottom || 0}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={block.marginBottom || 0}
              onChange={(e) => onUpdateBlock(block.id, {
                marginBottom: parseInt(e.target.value)
              })}
              style={{
                width: '100%',
                height: '4px',
                appearance: 'none',
                backgroundColor: '#475569',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            />
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
