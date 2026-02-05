/**
 * SheetSettingsPanel - Dark mode panel for sheet settings in PRO editor
 * 
 * Figma-inspired dark theme with grid system settings.
 */

import { useState } from 'react';
import { LayoutGrid, Eye, EyeOff, Layers, Move, Palette, X } from 'lucide-react';
import { GridColumns, GridGap, GRID_GAP_VALUES, GlobalFontSize } from '../../types/worksheet';

type LayoutMode = 'grid' | 'freeform';

// Color palette for page background
const PAGE_COLORS = [
  { value: '#FFFFFF', label: 'Bílá' },
  { value: '#F8F9FA', label: 'Šedá 50' },
  { value: '#F1F3F5', label: 'Šedá 100' },
  { value: '#E9ECEF', label: 'Šedá 200' },
  { value: '#FFFBEB', label: 'Žlutá 50' },
  { value: '#FEF3C7', label: 'Žlutá 100' },
  { value: '#FDE68A', label: 'Žlutá 200' },
  { value: '#FEF2F2', label: 'Červená 50' },
  { value: '#FEE2E2', label: 'Červená 100' },
  { value: '#FECACA', label: 'Červená 200' },
  { value: '#F0FDF4', label: 'Zelená 50' },
  { value: '#DCFCE7', label: 'Zelená 100' },
  { value: '#BBF7D0', label: 'Zelená 200' },
  { value: '#EFF6FF', label: 'Modrá 50' },
  { value: '#DBEAFE', label: 'Modrá 100' },
  { value: '#BFDBFE', label: 'Modrá 200' },
  { value: '#F5F3FF', label: 'Fialová 50' },
  { value: '#EDE9FE', label: 'Fialová 100' },
  { value: '#DDD6FE', label: 'Fialová 200' },
  { value: '#FDF4FF', label: 'Růžová 50' },
  { value: '#FAE8FF', label: 'Růžová 100' },
  { value: '#F5D0FE', label: 'Růžová 200' },
  { value: '#ECFEFF', label: 'Tyrkys 50' },
  { value: '#CFFAFE', label: 'Tyrkys 100' },
];

interface SheetSettingsPanelProps {
  gridColumns: GridColumns;
  gridGap: GridGap;
  globalFontSize: GlobalFontSize;
  pageFormat: 'a4' | 'b5' | 'a5';
  showGridOverlay: boolean;
  layoutMode: LayoutMode;
  pageBackgroundColor?: string;
  onGridColumnsChange: (columns: GridColumns) => void;
  onGridGapChange: (gap: GridGap) => void;
  onGlobalFontSizeChange: (size: GlobalFontSize) => void;
  onShowGridOverlayChange: (show: boolean) => void;
  onLayoutModeChange: (mode: LayoutMode) => void;
  onPageBackgroundColorChange: (color: string | undefined) => void;
}

// Grid column options
const GRID_OPTIONS: { value: GridColumns; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 6, label: '6' },
  { value: 12, label: '12' },
];

// Gap options
const GAP_OPTIONS: { value: GridGap; label: string; px: number }[] = [
  { value: 'none', label: 'Žádná', px: 0 },
  { value: 'small', label: 'Malá', px: 8 },
  { value: 'medium', label: 'Střední', px: 16 },
  { value: 'large', label: 'Velká', px: 24 },
];

// Font size options  
const FONT_SIZE_OPTIONS: { value: GlobalFontSize; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'normal', label: 'M' },
  { value: 'large', label: 'L' },
];

export function SheetSettingsPanel({
  gridColumns,
  gridGap,
  globalFontSize,
  pageFormat,
  showGridOverlay,
  layoutMode,
  pageBackgroundColor,
  onGridColumnsChange,
  onGridGapChange,
  onGlobalFontSizeChange,
  onShowGridOverlayChange,
  onLayoutModeChange,
  onPageBackgroundColorChange,
}: SheetSettingsPanelProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  return (
    <div style={{ 
      padding: '12px',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: '#1e293b',
      color: '#E5E5E5',
    }}>
      {/* Header */}
      <div style={{ 
        fontSize: '11px', 
        fontWeight: 600, 
        color: '#808080', 
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <LayoutGrid size={14} style={{ color: '#5C5CFF' }} />
        Nastavení listu
      </div>

      {/* Layout Mode Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '11px', 
          fontWeight: 500, 
          color: '#808080', 
          marginBottom: '6px' 
        }}>
          Režim
        </label>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onLayoutModeChange('grid')}
            style={{
              flex: 1,
              padding: '8px 6px',
              backgroundColor: layoutMode === 'grid' ? '#5C5CFF' : '#334155',
              color: layoutMode === 'grid' ? 'white' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Layers size={16} />
            Grid
          </button>
          <button
            onClick={() => onLayoutModeChange('freeform')}
            style={{
              flex: 1,
              padding: '8px 6px',
              backgroundColor: layoutMode === 'freeform' ? '#5C5CFF' : '#334155',
              color: layoutMode === 'freeform' ? 'white' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
              transition: 'all 0.1s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Move size={16} />
            Freeform
          </button>
        </div>
      </div>

      {/* Page Format Info */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '10px', 
        backgroundColor: '#334155', 
        borderRadius: '6px',
      }}>
        <label style={{ fontSize: '10px', color: '#808080', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Formát
        </label>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#E5E5E5', marginTop: '2px' }}>
          {pageFormat.toUpperCase()}
          <span style={{ fontSize: '11px', fontWeight: 400, color: '#808080', marginLeft: '6px' }}>
            {pageFormat === 'a4' ? '210×297' : pageFormat === 'b5' ? '176×250' : '148×210'}
          </span>
        </div>
      </div>

      {/* Page Background Color */}
      <div style={{ marginBottom: '16px', position: 'relative' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '10px', 
          fontWeight: 500, 
          color: '#808080', 
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Barva stránky
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Color preview button */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: pageBackgroundColor ? 'none' : '2px dashed #5C5C5C',
              backgroundColor: pageBackgroundColor || '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: pageBackgroundColor ? '0 1px 3px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {!pageBackgroundColor && <Palette size={14} style={{ color: '#808080' }} />}
          </button>
          
          {/* Color name/value */}
          <span style={{ fontSize: '11px', color: '#94a3b8', flex: 1 }}>
            {pageBackgroundColor 
              ? PAGE_COLORS.find(c => c.value === pageBackgroundColor)?.label || pageBackgroundColor
              : 'Bílá (výchozí)'}
          </span>
          
          {/* Clear button */}
          {pageBackgroundColor && pageBackgroundColor !== '#FFFFFF' && (
            <button
              onClick={() => onPageBackgroundColorChange(undefined)}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Obnovit výchozí"
            >
              <X size={12} style={{ color: '#808080' }} />
            </button>
          )}
        </div>

        {/* Color picker dropdown */}
        {showColorPicker && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 1000,
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '6px',
              marginBottom: '10px',
            }}>
              {PAGE_COLORS.map((color) => (
                <div
                  key={color.value}
                  title={color.label}
                  onClick={() => {
                    onPageBackgroundColorChange(color.value);
                    setShowColorPicker(false);
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    backgroundColor: color.value,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: pageBackgroundColor === color.value 
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
                input.value = pageBackgroundColor || '#FFFFFF';
                input.onchange = (e) => {
                  onPageBackgroundColorChange((e.target as HTMLInputElement).value);
                  setShowColorPicker(false);
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
              Vlastní barva...
            </div>
          </div>
        )}
      </div>

      {/* Grid Settings Group */}
      <div style={{ 
        marginBottom: '16px',
        padding: '10px',
        backgroundColor: '#1e293b',
        borderRadius: '6px',
        border: '1px solid #334155',
      }}>
        {/* Grid Columns */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '10px', 
            fontWeight: 500, 
            color: '#808080', 
            marginBottom: '6px' 
          }}>
            Sloupce
          </label>
          <div style={{ display: 'flex', gap: '3px' }}>
            {GRID_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onGridColumnsChange(option.value)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  backgroundColor: gridColumns === option.value ? '#5C5CFF' : '#334155',
                  color: gridColumns === option.value ? 'white' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.1s ease',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Gap */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '10px', 
            fontWeight: 500, 
            color: '#808080', 
            marginBottom: '6px' 
          }}>
            Mezera
          </label>
          <div style={{ display: 'flex', gap: '3px' }}>
            {GAP_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onGridGapChange(option.value)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  backgroundColor: gridGap === option.value ? '#5C5CFF' : '#334155',
                  color: gridGap === option.value ? 'white' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  transition: 'all 0.1s ease',
                }}
              >
                {option.px}
              </button>
            ))}
          </div>
        </div>

        {/* Show Grid Toggle */}
        <button
          onClick={() => onShowGridOverlayChange(!showGridOverlay)}
          style={{
            width: '100%',
            padding: '6px 8px',
            backgroundColor: showGridOverlay ? '#5C5CFF' : '#334155',
            color: showGridOverlay ? 'white' : '#94a3b8',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 500,
            transition: 'all 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {showGridOverlay ? <Eye size={12} /> : <EyeOff size={12} />}
          {showGridOverlay ? 'Grid ON' : 'Grid OFF'}
        </button>

        {/* Grid Preview */}
        <div 
          style={{ 
            display: 'grid',
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            gap: `${Math.min(GRID_GAP_VALUES[gridGap], 3)}px`,
            padding: '6px',
            marginTop: '10px',
            backgroundColor: '#1e293b',
            borderRadius: '4px',
          }}
        >
          {Array.from({ length: gridColumns }).map((_, i) => (
            <div 
              key={i}
              style={{
                height: '12px',
                backgroundColor: '#5C5CFF33',
                borderRadius: '2px',
                border: '1px dashed #5C5CFF66',
              }}
            />
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label style={{ 
          display: 'block', 
          fontSize: '10px', 
          fontWeight: 500, 
          color: '#808080', 
          marginBottom: '6px' 
        }}>
          Velikost textu
        </label>
        <div style={{ display: 'flex', gap: '3px' }}>
          {FONT_SIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onGlobalFontSizeChange(option.value)}
              style={{
                flex: 1,
                padding: '6px 0',
                backgroundColor: globalFontSize === option.value ? '#5C5CFF' : '#334155',
                color: globalFontSize === option.value ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.1s ease',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
