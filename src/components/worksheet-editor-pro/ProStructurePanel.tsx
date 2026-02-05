/**
 * ProStructurePanel - Dark mode structure panel for PRO editor
 */

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  Type,
  AlignLeft,
  Info,
  ListChecks,
  TextCursorInput,
  MessageSquare,
  Plus,
  SquareIcon,
  Calculator,
  ImageIcon,
  Table,
  FileText,
  QrCode,
  GripVertical,
  Palette,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Worksheet,
  BlockType,
  WorksheetBlock,
} from '../../types/worksheet';

interface ProStructurePanelProps {
  worksheet: Worksheet;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onHoverBlock?: (blockId: string | null) => void;
  onAddBlock: (type: BlockType) => void;
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
  'spacer': SquareIcon,
  'image': ImageIcon,
  'qr-code': QrCode,
  'header-footer': FileText,
  'free-canvas': Palette,
};

const BLOCK_LABELS: Record<BlockType, string> = {
  'heading': 'Nadpis',
  'paragraph': 'Odstavec',
  'infobox': 'Infobox',
  'multiple-choice': 'Výběr',
  'fill-blank': 'Doplnění',
  'free-answer': 'Volná',
  'connect-pairs': 'Spojovačka',
  'image-hotspots': 'Poznávačka',
  'video-quiz': 'Video',
  'examples': 'Příklady',
  'table': 'Tabulka',
  'spacer': 'Prostor',
  'image': 'Obrázek',
  'qr-code': 'QR',
  'header-footer': 'Hlavička',
  'free-canvas': 'Plátno',
};

function SortableBlockItem({ 
  block, 
  isSelected, 
  onSelect, 
  onHover 
}: { 
  block: WorksheetBlock; 
  isSelected: boolean; 
  onSelect: () => void;
  onHover?: (hovering: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const Icon = BLOCK_ICONS[block.type] || Type;
  const label = BLOCK_LABELS[block.type] || block.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors ${
        isSelected ? 'bg-[#5C5CFF]' : 'hover:bg-[#334155]'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical size={14} style={{ color: isSelected ? 'white' : '#808080' }} />
      </div>
      <Icon size={14} style={{ color: isSelected ? 'white' : '#94a3b8' }} />
      <span style={{ 
        fontSize: '12px', 
        fontWeight: 500, 
        color: isSelected ? 'white' : '#E5E5E5',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>
  );
}

export function ProStructurePanel({
  worksheet,
  selectedBlockId,
  onSelectBlock,
  onHoverBlock,
  onAddBlock,
}: ProStructurePanelProps) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      backgroundColor: '#1e293b',
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px', 
        borderBottom: '1px solid #334155',
        flexShrink: 0,
      }}>
        <h2 style={{ 
          fontSize: '11px', 
          fontWeight: 600, 
          color: '#808080', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px',
        }}>
          Struktura
        </h2>
        <p style={{ fontSize: '10px', color: '#606060', marginTop: '4px' }}>
          {worksheet.blocks.length} bloků
        </p>
      </div>

      {/* Block list */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '8px',
      }}>
        <SortableContext items={worksheet.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          {worksheet.blocks.map((block) => (
            <SortableBlockItem
              key={block.id}
              block={block}
              isSelected={selectedBlockId === block.id}
              onSelect={() => onSelectBlock(block.id)}
              onHover={(hovering) => onHoverBlock?.(hovering ? block.id : null)}
            />
          ))}
        </SortableContext>

        {worksheet.blocks.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '24px 16px',
            color: '#808080',
          }}>
            <p style={{ fontSize: '12px', marginBottom: '8px' }}>Žádné bloky</p>
            <p style={{ fontSize: '11px', color: '#606060' }}>Přidejte obsah pomocí panelu Přidat</p>
          </div>
        )}
      </div>

      {/* Add button */}
      <div style={{ 
        padding: '12px', 
        borderTop: '1px solid #334155',
        flexShrink: 0,
      }}>
        <button
          onClick={() => onAddBlock('paragraph')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px',
            backgroundColor: '#334155',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.1s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#475569'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#334155'}
        >
          <Plus size={16} />
          Přidat blok
        </button>
      </div>
    </div>
  );
}
