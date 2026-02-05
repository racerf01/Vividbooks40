/**
 * ProSidebar - Extended sidebar for Pro editor
 * Dark theme, more options, developer tools
 */

import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Plus, 
  Sparkles,
  SlidersHorizontal, 
  Loader2,
  ArrowLeft,
  Layout,
  FileDown,
  PanelLeftClose,
  Crown,
  Library,
} from 'lucide-react';
import { SaveStatus } from '../../types/worksheet-editor';

export type ProActivePanel = 'structure' | 'add' | 'ai' | 'settings' | 'templates' | 'export';

interface ProSidebarProps {
  activePanel: ProActivePanel;
  onPanelChange: (panel: ProActivePanel) => void;
  saveStatus: SaveStatus;
  onBack: () => void;
  onToggleCollapse: () => void;
  onOpenWorkbook?: () => void;
}

function SidebarButton({ 
  onClick, 
  isActive = false, 
  icon: Icon, 
  label,
  variant = 'default',
  disabled = false,
  isLoading = false,
}: { 
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  variant?: 'default' | 'accent' | 'pro';
  disabled?: boolean;
  isLoading?: boolean;
}) {
  const getBgColor = () => {
    if (variant === 'accent') return isLoading ? '#8B5CF6' : '#7C3AED';
    if (variant === 'pro') return '#F59E0B';
    return isActive ? '#3B82F6' : 'rgba(255,255,255,0.1)';
  };
  
  const iconColor = isActive || variant !== 'default' ? 'white' : '#94A3B8';
  const labelColor = isActive ? 'white' : '#94A3B8';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (!disabled && !isLoading) onClick();
      }}
      disabled={disabled || isLoading}
      className="flex flex-col items-center cursor-pointer bg-transparent border-none p-0 mb-2 group"
    >
      <div 
        className="w-16 h-16 rounded-xl flex items-center justify-center transition-all group-hover:scale-105"
        style={{ backgroundColor: getBgColor() }}
      >
        {isLoading ? (
          <Loader2 size={26} className="animate-spin" style={{ color: iconColor }} strokeWidth={1.5} />
        ) : (
          <Icon size={26} strokeWidth={1.5} style={{ color: iconColor }} />
        )}
      </div>
      <span 
        className="text-xs font-medium mt-2 text-center transition-colors"
        style={{ color: labelColor }}
      >
        {isLoading ? 'Načítám...' : label}
      </span>
    </button>
  );
}

function AddContentButton({ 
  onClick, 
  isActive,
}: { 
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center cursor-pointer bg-transparent border-none p-0 mb-2 group"
    >
      <div 
        className="w-16 h-16 rounded-xl flex items-center justify-center transition-all group-hover:scale-105"
        style={{ backgroundColor: isActive ? '#3B82F6' : 'rgba(255,255,255,0.1)' }}
      >
        <div 
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#3B82F6' }}
        >
          <Plus size={20} strokeWidth={2} style={{ color: 'white' }} />
        </div>
      </div>
      <span 
        className="text-xs font-medium mt-2 text-center"
        style={{ color: isActive ? 'white' : '#94A3B8' }}
      >
        Přidat
      </span>
    </button>
  );
}

export function ProSidebar({ 
  activePanel, 
  onPanelChange, 
  saveStatus,
  onBack,
  onToggleCollapse,
  onOpenWorkbook,
}: ProSidebarProps) {
  return (
    <div 
      className="w-24 min-w-24 h-full flex flex-col items-center py-4 border-r border-slate-700"
      style={{ backgroundColor: '#1E293B' }}
    >
      {/* Pro Badge */}
      <div className="flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500">
        <Crown size={12} className="text-white" />
        <span className="text-xs font-bold text-white">PRO</span>
      </div>
      
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        disabled={saveStatus === 'saving'}
        className="flex items-center gap-1.5 mb-2 cursor-pointer bg-transparent border-none p-0 group"
      >
        {saveStatus === 'saving' ? (
          <>
            <Loader2 size={14} className="animate-spin text-blue-400" strokeWidth={2} />
            <span className="text-xs font-medium text-blue-400">Ukládám...</span>
          </>
        ) : (
          <>
            <ArrowLeft size={14} strokeWidth={2} className="text-slate-400 group-hover:text-white transition-colors" />
            <span className="text-xs font-medium text-slate-400 group-hover:text-white transition-colors">Zpět</span>
          </>
        )}
      </button>
      
      {/* Workbook button */}
      {onOpenWorkbook && (
        <button
          type="button"
          onClick={onOpenWorkbook}
          className="flex flex-col items-center gap-1 mb-4 cursor-pointer bg-transparent border-none p-0 group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-colors">
            <Library size={18} className="text-white" strokeWidth={2} />
          </div>
          <span className="text-[10px] font-medium text-emerald-400 group-hover:text-emerald-300 transition-colors">Sešit</span>
        </button>
      )}
      
      {/* Divider */}
      <div className="w-12 h-px bg-slate-600 mb-4" />
      
      {/* Main buttons */}
      <SidebarButton
        onClick={() => onPanelChange('structure')}
        isActive={activePanel === 'structure'}
        icon={BookOpen}
        label="Struktura"
      />
      
      <AddContentButton
        onClick={() => onPanelChange('add')}
        isActive={activePanel === 'add'}
      />
      
      <SidebarButton
        onClick={() => onPanelChange('ai')}
        isActive={activePanel === 'ai'}
        icon={Sparkles}
        label="AI"
        variant="accent"
      />
      
      {/* Divider */}
      <div className="w-12 h-px bg-slate-600 my-4" />
      
      {/* Pro features */}
      <SidebarButton
        onClick={() => onPanelChange('templates')}
        isActive={activePanel === 'templates'}
        icon={Layout}
        label="Šablony"
      />
      
      <SidebarButton
        onClick={() => onPanelChange('export')}
        isActive={activePanel === 'export'}
        icon={FileDown}
        label="Export"
      />
      
      <SidebarButton
        onClick={() => onPanelChange('settings')}
        isActive={activePanel === 'settings'}
        icon={SlidersHorizontal}
        label="Nastavení"
      />
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Collapse button */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-700 hover:bg-slate-600 transition-colors cursor-pointer border-none"
      >
        <PanelLeftClose size={18} className="text-slate-400" />
      </button>
    </div>
  );
}
