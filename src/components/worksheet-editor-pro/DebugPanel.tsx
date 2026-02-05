/**
 * DebugPanel - Developer debug panel for Pro editor
 * Shows worksheet state, selected block info, performance metrics
 */

import { useState } from 'react';
import { 
  X, 
  Copy, 
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
  Clock,
  Bug,
} from 'lucide-react';
import { Worksheet } from '../../types/worksheet';
import { toast } from 'sonner';

interface DebugPanelProps {
  worksheet: Worksheet;
  selectedBlockId: string | null;
  onClose: () => void;
}

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-slate-700">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-700/50 transition-colors cursor-pointer bg-transparent border-none text-left"
      >
        {isOpen ? (
          <ChevronDown size={14} className="text-slate-400" />
        ) : (
          <ChevronRight size={14} className="text-slate-400" />
        )}
        <Icon size={14} className="text-slate-400" />
        <span className="text-sm font-medium text-slate-200">{title}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

function JsonView({ data, maxHeight = 200 }: { data: any; maxHeight?: number }) {
  const [copied, setCopied] = useState(false);
  
  const jsonString = JSON.stringify(data, null, 2);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    toast.success('Zkopírováno do schránky');
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-slate-600 hover:bg-slate-500 transition-colors cursor-pointer border-none"
        title="Kopírovat JSON"
      >
        {copied ? (
          <Check size={12} className="text-green-400" />
        ) : (
          <Copy size={12} className="text-slate-300" />
        )}
      </button>
      <pre 
        className="text-xs font-mono text-slate-300 bg-slate-900 rounded-lg p-3 overflow-auto"
        style={{ maxHeight }}
      >
        {jsonString}
      </pre>
    </div>
  );
}

export function DebugPanel({ worksheet, selectedBlockId, onClose }: DebugPanelProps) {
  const selectedBlock = worksheet.blocks.find(b => b.id === selectedBlockId);
  
  const stats = {
    blocksCount: worksheet.blocks.length,
    blockTypes: [...new Set(worksheet.blocks.map(b => b.type))],
    averageBlockSize: worksheet.blocks.length > 0 
      ? Math.round(JSON.stringify(worksheet.blocks).length / worksheet.blocks.length) 
      : 0,
    totalSize: JSON.stringify(worksheet).length,
    createdAt: worksheet.createdAt,
    updatedAt: worksheet.updatedAt,
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-white">Debug Panel</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded hover:bg-slate-700 transition-colors cursor-pointer bg-transparent border-none"
        >
          <X size={16} className="text-slate-400" />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Stats */}
        <CollapsibleSection title="Statistiky" icon={Database} defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{stats.blocksCount}</div>
              <div className="text-xs text-slate-400">Bloků</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{stats.blockTypes.length}</div>
              <div className="text-xs text-slate-400">Typů bloků</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{(stats.totalSize / 1024).toFixed(1)} KB</div>
              <div className="text-xs text-slate-400">Celková velikost</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-lg font-bold text-white">{stats.averageBlockSize} B</div>
              <div className="text-xs text-slate-400">Průměr na blok</div>
            </div>
          </div>
          
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Typy bloků:</span>
              <span className="text-slate-200">{stats.blockTypes.join(', ')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Vytvořeno:</span>
              <span className="text-slate-200">{new Date(stats.createdAt || '').toLocaleString('cs-CZ')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Upraveno:</span>
              <span className="text-slate-200">{new Date(stats.updatedAt || '').toLocaleString('cs-CZ')}</span>
            </div>
          </div>
        </CollapsibleSection>
        
        {/* Selected Block */}
        <CollapsibleSection title="Vybraný blok" icon={Layers} defaultOpen={!!selectedBlock}>
          {selectedBlock ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">ID:</span>
                <code className="text-blue-400 bg-slate-900 px-1.5 py-0.5 rounded">{selectedBlock.id}</code>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Typ:</span>
                <span className="text-slate-200">{selectedBlock.type}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Šířka:</span>
                <span className="text-slate-200">{selectedBlock.width} ({selectedBlock.widthPercent || 'auto'}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Pořadí:</span>
                <span className="text-slate-200">{selectedBlock.order}</span>
              </div>
              
              <div className="mt-3">
                <div className="text-xs text-slate-400 mb-2">Content:</div>
                <JsonView data={selectedBlock.content} />
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-4">
              Vyberte blok pro zobrazení detailů
            </div>
          )}
        </CollapsibleSection>
        
        {/* Worksheet Metadata */}
        <CollapsibleSection title="Metadata" icon={Clock}>
          <JsonView data={worksheet.metadata} />
        </CollapsibleSection>
        
        {/* All Blocks Summary */}
        <CollapsibleSection title="Všechny bloky" icon={Layers}>
          <div className="space-y-2">
            {worksheet.blocks.map((block, index) => (
              <div 
                key={block.id}
                className={`
                  text-xs px-3 py-2 rounded-lg flex items-center justify-between
                  ${selectedBlockId === block.id ? 'bg-blue-600/30 border border-blue-500' : 'bg-slate-900'}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">#{index}</span>
                  <span className="text-slate-200">{block.type}</span>
                </div>
                <span className="text-slate-500 font-mono">{block.width}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
