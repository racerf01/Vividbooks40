/**
 * JsonEditorPanel - Direct JSON editing for Pro editor
 * Allows editing worksheet data directly as JSON
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Save,
  RotateCcw,
  AlertTriangle,
  Check,
  Copy,
  Download,
  Upload,
} from 'lucide-react';
import { Worksheet } from '../../types/worksheet';
import { toast } from 'sonner';

interface JsonEditorPanelProps {
  worksheet: Worksheet;
  onUpdateWorksheet: (worksheet: Worksheet) => void;
  onClose: () => void;
}

export function JsonEditorPanel({ worksheet, onUpdateWorksheet, onClose }: JsonEditorPanelProps) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Initialize JSON text
  useEffect(() => {
    setJsonText(JSON.stringify(worksheet, null, 2));
    setHasChanges(false);
    setError(null);
  }, [worksheet]);
  
  // Validate JSON on change
  const handleTextChange = useCallback((text: string) => {
    setJsonText(text);
    setHasChanges(true);
    
    try {
      JSON.parse(text);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  
  // Apply changes
  const handleApply = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      
      // Basic validation
      if (!parsed.id || !Array.isArray(parsed.blocks)) {
        throw new Error('Invalid worksheet structure: missing id or blocks');
      }
      
      onUpdateWorksheet(parsed);
      setHasChanges(false);
      toast.success('Změny aplikovány');
    } catch (e: any) {
      toast.error('Nepodařilo se aplikovat změny: ' + e.message);
    }
  }, [jsonText, onUpdateWorksheet]);
  
  // Reset to original
  const handleReset = useCallback(() => {
    setJsonText(JSON.stringify(worksheet, null, 2));
    setHasChanges(false);
    setError(null);
  }, [worksheet]);
  
  // Copy to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(jsonText);
    toast.success('Zkopírováno do schránky');
  }, [jsonText]);
  
  // Download as file
  const handleDownload = useCallback(() => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worksheet-${worksheet.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Soubor stažen');
  }, [jsonText, worksheet.id]);
  
  // Import from file
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        handleTextChange(text);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [handleTextChange]);
  
  return (
    <div className="h-full flex flex-col bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">JSON Editor</span>
          {hasChanges && (
            <span className="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400">
              Neuloženo
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded hover:bg-slate-700 transition-colors cursor-pointer bg-transparent border-none"
        >
          <X size={16} className="text-slate-400" />
        </button>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700 bg-slate-900">
        <button
          type="button"
          onClick={handleApply}
          disabled={!!error || !hasChanges}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border-none
            ${error || !hasChanges 
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-500'}
          `}
        >
          <Save size={14} />
          Aplikovat
        </button>
        
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasChanges}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw size={14} />
          Reset
        </button>
        
        <div className="flex-1" />
        
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-slate-700 transition-colors cursor-pointer bg-transparent border-none"
          title="Kopírovat"
        >
          <Copy size={14} className="text-slate-400" />
        </button>
        
        <button
          type="button"
          onClick={handleDownload}
          className="p-1.5 rounded hover:bg-slate-700 transition-colors cursor-pointer bg-transparent border-none"
          title="Stáhnout"
        >
          <Download size={14} className="text-slate-400" />
        </button>
        
        <button
          type="button"
          onClick={handleImport}
          className="p-1.5 rounded hover:bg-slate-700 transition-colors cursor-pointer bg-transparent border-none"
          title="Importovat"
        >
          <Upload size={14} className="text-slate-400" />
        </button>
      </div>
      
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-900/50 border-b border-red-700">
          <AlertTriangle size={14} className="text-red-400" />
          <span className="text-xs text-red-300 truncate">{error}</span>
        </div>
      )}
      
      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <textarea
          value={jsonText}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full h-full p-4 bg-slate-900 text-slate-200 font-mono text-xs resize-none border-none outline-none"
          style={{ lineHeight: 1.6 }}
          spellCheck={false}
        />
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700 bg-slate-900">
        <span className="text-xs text-slate-500">
          {jsonText.length.toLocaleString()} znaků
        </span>
        <span className="text-xs text-slate-500">
          {worksheet.blocks.length} bloků
        </span>
      </div>
    </div>
  );
}
