/**
 * ProToolbar - Top toolbar for Pro editor
 * Includes zoom, undo/redo, save, export, and developer tools
 */

import { 
  Undo2, 
  Redo2, 
  Save,
  Download,
  Eye,
  History,
  Bug,
  Braces,
  Settings,
  PanelLeft,
  PanelRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Worksheet } from '../../types/worksheet';
import { SaveStatus } from '../../types/worksheet-editor';

interface ProToolbarProps {
  worksheet: Worksheet;
  saveStatus: SaveStatus;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onExport: () => void;
  isExporting: boolean;
  onOpenHistory: () => void;
  hasUnsavedVersions: boolean;
  leftPanelCollapsed: boolean;
  onToggleLeftPanel: () => void;
  rightPanelCollapsed: boolean;
  onToggleRightPanel: () => void;
  rightPanel: 'settings' | 'debug' | 'json' | null;
  onRightPanelChange: (panel: 'settings' | 'debug' | 'json' | null) => void;
}

function ToolbarButton({
  onClick,
  disabled = false,
  active = false,
  icon: Icon,
  label,
  shortcut,
  indicator,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  shortcut?: string;
  indicator?: 'warning' | 'success' | 'loading';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      className={`
        relative w-9 h-9 rounded-lg flex items-center justify-center transition-all
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-600'}
        ${active ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}
        border-none
      `}
    >
      <Icon size={18} />
      {indicator && (
        <span className={`
          absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800
          ${indicator === 'warning' ? 'bg-amber-500' : ''}
          ${indicator === 'success' ? 'bg-green-500' : ''}
          ${indicator === 'loading' ? 'bg-blue-500 animate-pulse' : ''}
        `} />
      )}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-slate-600 mx-2" />;
}

export function ProToolbar({
  worksheet,
  saveStatus,
  zoom,
  onZoomChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onExport,
  isExporting,
  onOpenHistory,
  hasUnsavedVersions,
  leftPanelCollapsed,
  onToggleLeftPanel,
  rightPanelCollapsed,
  onToggleRightPanel,
  rightPanel,
  onRightPanelChange,
}: ProToolbarProps) {
  const zoomLevels = [50, 75, 100, 125, 150, 200];
  
  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(zoom);
    if (currentIndex < zoomLevels.length - 1) {
      onZoomChange(zoomLevels[currentIndex + 1]);
    }
  };
  
  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(zoom);
    if (currentIndex > 0) {
      onZoomChange(zoomLevels[currentIndex - 1]);
    }
  };
  
  return (
    <div 
      className="h-14 flex items-center justify-between px-4 border-b border-slate-700"
      style={{ backgroundColor: '#0F172A' }}
    >
      {/* Left section - Panel toggle & Title */}
      <div className="flex items-center gap-3">
        {leftPanelCollapsed && (
          <ToolbarButton
            onClick={onToggleLeftPanel}
            icon={PanelLeft}
            label="Zobrazit panel"
          />
        )}
        
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-white truncate max-w-[200px]">
            {worksheet.title || 'Nový pracovní list'}
          </h1>
          <div className="flex items-center gap-1.5">
            {saveStatus === 'saving' && (
              <>
                <Loader2 size={10} className="animate-spin text-blue-400" />
                <span className="text-xs text-blue-400">Ukládám...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check size={10} className="text-green-400" />
                <span className="text-xs text-green-400">Uloženo</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <AlertCircle size={10} className="text-amber-400" />
                <span className="text-xs text-amber-400">Neuloženo</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Center section - Main actions */}
      <div className="flex items-center gap-1.5">
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={onUndo}
          disabled={!canUndo}
          icon={Undo2}
          label="Zpět"
          shortcut="Ctrl+Z"
        />
        <ToolbarButton
          onClick={onRedo}
          disabled={!canRedo}
          icon={Redo2}
          label="Vpřed"
          shortcut="Ctrl+Shift+Z"
        />
        
        <ToolbarDivider />
        
        {/* Zoom */}
        <ToolbarButton
          onClick={handleZoomOut}
          disabled={zoom <= 50}
          icon={ZoomOut}
          label="Oddálit"
        />
        <span className="text-xs text-slate-400 w-12 text-center font-mono">
          {zoom}%
        </span>
        <ToolbarButton
          onClick={handleZoomIn}
          disabled={zoom >= 200}
          icon={ZoomIn}
          label="Přiblížit"
        />
        
        <ToolbarDivider />
        
        {/* Save & Export */}
        <ToolbarButton
          onClick={onSave}
          icon={Save}
          label="Uložit"
          shortcut="Ctrl+S"
          indicator={saveStatus === 'unsaved' ? 'warning' : undefined}
        />
        <ToolbarButton
          onClick={onOpenHistory}
          icon={History}
          label="Historie verzí"
          indicator={hasUnsavedVersions ? 'warning' : undefined}
        />
        <ToolbarButton
          onClick={onExport}
          disabled={isExporting}
          icon={isExporting ? Loader2 : Download}
          label="Exportovat PDF"
          shortcut="Ctrl+Shift+E"
        />
        <ToolbarButton
          onClick={onExport}
          icon={Eye}
          label="Náhled"
        />
      </div>
      
      {/* Right section - Developer tools */}
      <div className="flex items-center gap-1.5">
        <ToolbarButton
          onClick={() => onRightPanelChange(rightPanel === 'debug' ? null : 'debug')}
          active={rightPanel === 'debug'}
          icon={Bug}
          label="Debug"
          shortcut="Ctrl+Shift+D"
        />
        <ToolbarButton
          onClick={() => onRightPanelChange(rightPanel === 'json' ? null : 'json')}
          active={rightPanel === 'json'}
          icon={Braces}
          label="JSON Editor"
          shortcut="Ctrl+Shift+J"
        />
        <ToolbarButton
          onClick={() => onRightPanelChange(rightPanel === 'settings' ? null : 'settings')}
          active={rightPanel === 'settings'}
          icon={Settings}
          label="Nastavení"
        />
        
        {!rightPanelCollapsed && (
          <ToolbarButton
            onClick={onToggleRightPanel}
            icon={PanelRight}
            label="Skrýt panel"
          />
        )}
      </div>
    </div>
  );
}
