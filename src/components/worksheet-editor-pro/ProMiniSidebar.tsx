/**
 * ProMiniSidebar - Figma-style dark sidebar for PRO editor
 * 
 * Narrow icon-only sidebar with tooltips, dark mode inspired by Figma.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Plus, 
  Sparkles,
  SlidersHorizontal, 
  Loader2,
  ArrowLeft,
  History,
  LayoutGrid,
} from 'lucide-react';

export type ProActivePanel = 'sheet-settings' | 'structure' | 'add' | 'ai' | 'settings' | 'history';
type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface ProMiniSidebarProps {
  activePanel: ProActivePanel;
  onPanelChange: (panel: ProActivePanel) => void;
  saveStatus: SaveStatus;
  hideAI?: boolean;
  onOpenHistory?: () => void;
  hasUnsavedVersions?: boolean;
  workbookId?: string | null;
}

// Figma-style icon button with tooltip
function IconButton({ 
  onClick, 
  isActive = false, 
  icon: Icon, 
  label,
  disabled = false,
  isLoading = false,
  hasNotification = false,
}: { 
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  disabled?: boolean;
  isLoading?: boolean;
  hasNotification?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          if (!disabled && !isLoading) {
            onClick();
          }
        }}
        disabled={disabled || isLoading}
        style={{ 
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: isActive ? '#5C5CFF' : isHovered ? '#334155' : 'transparent',
          border: 'none',
          borderRadius: '6px',
          padding: 0,
          transition: 'all 0.1s ease',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {isLoading ? (
          <Loader2 size={18} strokeWidth={1.8} className="animate-spin" style={{ color: '#94a3b8' }} />
        ) : (
          <Icon size={18} strokeWidth={1.8} style={{ color: isActive ? 'white' : '#94a3b8' }} />
        )}
      </button>
      
      {/* Notification dot */}
      {hasNotification && (
        <div 
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '8px',
            height: '8px',
            backgroundColor: '#FF4444',
            borderRadius: '50%',
            border: '2px solid #1e293b',
          }}
        />
      )}
      
      {/* Tooltip */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            left: '44px',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#0f172a',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function ProMiniSidebar({ 
  activePanel, 
  onPanelChange, 
  saveStatus,
  hideAI = false,
  onOpenHistory,
  hasUnsavedVersions = false,
  workbookId,
}: ProMiniSidebarProps) {
  const navigate = useNavigate();
  const [backHovered, setBackHovered] = useState(false);

  const handleBack = () => {
    // Navigate back to workbook editor if we came from there, otherwise to content library
    if (workbookId) {
      navigate(`/admin/workbook-pro/${workbookId}`);
    } else {
      navigate('/library/my-content');
    }
  };

  return (
    <aside 
      style={{ 
        width: '48px', 
        backgroundColor: '#1e293b',
        borderRight: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '8px',
        paddingBottom: '8px',
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        gap: '4px',
      }}
    >
      {/* Back button */}
      <div 
        style={{ position: 'relative', marginBottom: '4px' }}
        onMouseEnter={() => setBackHovered(true)}
        onMouseLeave={() => setBackHovered(false)}
      >
        <button
          onClick={handleBack}
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: backHovered ? '#334155' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.1s ease',
          }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} style={{ color: '#94a3b8' }} />
        </button>
        {backHovered && (
          <div
            style={{
              position: 'absolute',
              left: '44px',
              top: '50%',
              transform: 'translateY(-50)',
              backgroundColor: '#0f172a',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            Zpět
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: '24px', height: '1px', backgroundColor: '#334155', margin: '4px 0' }} />

      {/* Sheet Settings */}
      <IconButton
        onClick={() => onPanelChange('sheet-settings')}
        isActive={activePanel === 'sheet-settings'}
        icon={LayoutGrid}
        label="Nastavení listu"
      />

      {/* Structure */}
      <IconButton
        onClick={() => onPanelChange('structure')}
        isActive={activePanel === 'structure'}
        icon={BookOpen}
        label="Můj list"
      />

      {/* Add Content */}
      <IconButton
        onClick={() => onPanelChange('add')}
        isActive={activePanel === 'add'}
        icon={Plus}
        label="Přidat obsah"
      />

      {/* AI */}
      {!hideAI && (
        <IconButton
          onClick={() => onPanelChange('ai')}
          isActive={activePanel === 'ai'}
          icon={Sparkles}
          label="AI asistent"
        />
      )}

      {/* Settings */}
      <IconButton
        onClick={() => onPanelChange('settings')}
        isActive={activePanel === 'settings'}
        icon={SlidersHorizontal}
        label="Nastavení"
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* History */}
      {onOpenHistory && (
        <IconButton
          onClick={onOpenHistory}
          isActive={activePanel === 'history'}
          icon={History}
          label="Historie verzí"
          hasNotification={hasUnsavedVersions}
        />
      )}

      {/* Save Status Indicator */}
      <div 
        style={{ 
          marginTop: '4px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: saveStatus === 'saved' ? '#4ADE80' : saveStatus === 'saving' ? '#FBBF24' : '#EF4444',
          boxShadow: `0 0 6px ${saveStatus === 'saved' ? '#4ADE80' : saveStatus === 'saving' ? '#FBBF24' : '#EF4444'}`,
        }}
        title={saveStatus === 'saved' ? 'Uloženo' : saveStatus === 'saving' ? 'Ukládám...' : 'Neuloženo'}
      />
    </aside>
  );
}
