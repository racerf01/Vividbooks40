/**
 * ProAddContentPanel - Dark mode panel for adding content in PRO editor
 */

import { useState } from 'react';
import {
  Type,
  AlignLeft,
  ListChecks,
  PenLine,
  MessageSquare,
  Square,
  Calculator,
  ImageIcon,
  Table,
  Link2,
  MapPin,
  Video,
  Info,
  FileText,
  QrCode,
  GripVertical,
  Palette,
} from 'lucide-react';
import { BlockType } from '../../types/worksheet';

interface ProAddContentPanelProps {
  onAddBlock: (type: BlockType) => void;
  pendingInsertType?: BlockType | null;
  onInsertAtEnd?: () => void;
  onCancelInsert?: () => void;
  onDragStart?: (type: BlockType) => void;
  onDragEnd?: () => void;
}

const informationBlocks: Array<{
  type: BlockType;
  icon: typeof Type;
  label: string;
}> = [
  { type: 'heading', icon: Type, label: 'Nadpis' },
  { type: 'paragraph', icon: AlignLeft, label: 'Odstavec' },
  { type: 'infobox', icon: Info, label: 'Infobox' },
  { type: 'image', icon: ImageIcon, label: 'Obrázek' },
  { type: 'table', icon: Table, label: 'Tabulka' },
  { type: 'qr-code', icon: QrCode, label: 'QR kód' },
  { type: 'spacer', icon: Square, label: 'Prostor' },
  { type: 'header-footer', icon: FileText, label: 'Hlavička' },
];

const activityBlocks: Array<{
  type: BlockType;
  icon: typeof Type;
  label: string;
}> = [
  { type: 'multiple-choice', icon: ListChecks, label: 'Výběr' },
  { type: 'fill-blank', icon: PenLine, label: 'Doplnění' },
  { type: 'free-answer', icon: MessageSquare, label: 'Volná' },
  { type: 'connect-pairs', icon: Link2, label: 'Spojovačka' },
  { type: 'image-hotspots', icon: MapPin, label: 'Poznávačka' },
  { type: 'video-quiz', icon: Video, label: 'Video' },
  { type: 'examples', icon: Calculator, label: 'Příklady' },
  { type: 'free-canvas', icon: Palette, label: 'Plátno' },
];

const allBlocks = [...informationBlocks, ...activityBlocks];

export function ProAddContentPanel({ onAddBlock, pendingInsertType, onInsertAtEnd, onCancelInsert, onDragStart, onDragEnd }: ProAddContentPanelProps) {
  const [draggingType, setDraggingType] = useState<BlockType | null>(null);

  const handleDragStart = (e: React.DragEvent, type: BlockType) => {
    setDraggingType(type);
    e.dataTransfer.setData('application/x-block-type', type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(type);
  };

  const handleDragEnd = () => {
    setDraggingType(null);
    onDragEnd?.();
  };

  if (pendingInsertType) {
    const selected = allBlocks.find(b => b.type === pendingInsertType);
    const SelectedIcon = selected?.icon;
    return (
      <div style={{ padding: '16px', height: '100%', overflowY: 'auto', backgroundColor: '#1e293b', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {SelectedIcon && <SelectedIcon size={20} style={{ color: '#5C5CFF' }} />}
          </div>
          <div>
            <p style={{ fontSize: '10px', color: '#808080', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vkládáte</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#E5E5E5' }}>{selected?.label}</p>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#E5E5E5', marginBottom: '12px' }}>Kam vložit?</h2>
          <p style={{ fontSize: '12px', color: '#808080', marginBottom: '24px' }}>Klikněte na modrou linku mezi bloky.</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
            <span style={{ fontSize: '10px', color: '#808080', textTransform: 'uppercase' }}>nebo</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
          </div>

          <button
            onClick={onInsertAtEnd}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', backgroundColor: '#5C5CFF', color: 'white', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            Vložit na konec
          </button>
        </div>

        <button
          onClick={onCancelInsert}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#334155', color: '#94a3b8', border: 'none', fontWeight: 500, fontSize: '12px', cursor: 'pointer', marginTop: '16px' }}
        >
          Zrušit
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', height: '100%', overflowY: 'auto', backgroundColor: '#1e293b' }}>
      <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        Informace
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '16px' }}>
        {informationBlocks.map(({ type, icon: Icon, label }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            onDragEnd={handleDragEnd}
            onClick={() => onAddBlock(type)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '12px 8px',
              backgroundColor: draggingType === type ? '#5C5CFF' : '#334155',
              borderRadius: '8px',
              border: 'none',
              cursor: 'grab',
              transition: 'all 0.1s ease',
              opacity: draggingType === type ? 0.6 : 1,
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (draggingType !== type) {
                e.currentTarget.style.backgroundColor = '#475569';
              }
            }}
            onMouseLeave={(e) => {
              if (draggingType !== type) {
                e.currentTarget.style.backgroundColor = '#334155';
              }
            }}
          >
            <GripVertical size={12} style={{ position: 'absolute', top: '4px', right: '4px', color: '#606060' }} />
            <Icon size={20} style={{ color: draggingType === type ? 'white' : '#94a3b8' }} />
            <span style={{ fontSize: '10px', fontWeight: 500, color: draggingType === type ? 'white' : '#94a3b8', textAlign: 'center' }}>{label}</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '11px', fontWeight: 600, color: '#808080', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        Aktivity
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
        {activityBlocks.map(({ type, icon: Icon, label }) => (
          <div
            key={type}
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            onDragEnd={handleDragEnd}
            onClick={() => onAddBlock(type)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '12px 8px',
              backgroundColor: draggingType === type ? '#5C5CFF' : '#334155',
              borderRadius: '8px',
              border: 'none',
              cursor: 'grab',
              transition: 'all 0.1s ease',
              opacity: draggingType === type ? 0.6 : 1,
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (draggingType !== type) {
                e.currentTarget.style.backgroundColor = '#475569';
              }
            }}
            onMouseLeave={(e) => {
              if (draggingType !== type) {
                e.currentTarget.style.backgroundColor = '#334155';
              }
            }}
          >
            <GripVertical size={12} style={{ position: 'absolute', top: '4px', right: '4px', color: '#606060' }} />
            <Icon size={20} style={{ color: draggingType === type ? 'white' : '#94a3b8' }} />
            <span style={{ fontSize: '10px', fontWeight: 500, color: draggingType === type ? 'white' : '#94a3b8', textAlign: 'center' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
