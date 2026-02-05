/**
 * ExportPanel - Export options for Pro editor
 * Multiple export formats, quality settings
 */

import { useState } from 'react';
import { 
  Download,
  FileText,
  FileImage,
  FileJson,
  Printer,
  Settings,
  Loader2,
} from 'lucide-react';
import { Worksheet } from '../../types/worksheet';
import { toast } from 'sonner';

interface ExportPanelProps {
  worksheet: Worksheet;
  onExportPDF: () => void;
  isExporting: boolean;
}

type ExportFormat = 'pdf' | 'png' | 'json' | 'html';
type PaperSize = 'a4' | 'letter' | 'legal';
type Quality = 'draft' | 'standard' | 'high';

export function ExportPanel({ worksheet, onExportPDF, isExporting }: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [quality, setQuality] = useState<Quality>('standard');
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(false);
  
  const handleExport = () => {
    switch (selectedFormat) {
      case 'pdf':
        onExportPDF();
        break;
      case 'json':
        const blob = new Blob([JSON.stringify(worksheet, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${worksheet.title || 'worksheet'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('JSON exportován');
        break;
      default:
        toast.info(`Export do ${selectedFormat.toUpperCase()} bude brzy k dispozici`);
    }
  };
  
  const formats: { id: ExportFormat; name: string; icon: typeof FileText; description: string }[] = [
    { id: 'pdf', name: 'PDF', icon: FileText, description: 'Pro tisk a sdílení' },
    { id: 'png', name: 'Obrázek', icon: FileImage, description: 'PNG obrázek' },
    { id: 'json', name: 'JSON', icon: FileJson, description: 'Surová data' },
    { id: 'html', name: 'HTML', icon: Printer, description: 'Webová stránka' },
  ];
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Download size={20} />
          Export
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Exportujte pracovní list do různých formátů
        </p>
      </div>
      
      {/* Format selection */}
      <div className="px-4 py-4 border-b border-slate-700">
        <h4 className="text-sm font-medium text-white mb-3">Formát</h4>
        <div className="grid grid-cols-2 gap-2">
          {formats.map(format => (
            <button
              key={format.id}
              type="button"
              onClick={() => setSelectedFormat(format.id)}
              className={`
                flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer border-none text-left
                ${selectedFormat === format.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-700'}
              `}
            >
              <format.icon size={20} />
              <div>
                <div className="font-medium text-sm">{format.name}</div>
                <div className="text-xs opacity-70">{format.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Settings */}
      {selectedFormat === 'pdf' && (
        <div className="px-4 py-4 border-b border-slate-700 space-y-4">
          <h4 className="text-sm font-medium text-white flex items-center gap-2">
            <Settings size={14} />
            Nastavení PDF
          </h4>
          
          {/* Paper size */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Velikost papíru</label>
            <div className="flex gap-2">
              {(['a4', 'letter', 'legal'] as PaperSize[]).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPaperSize(size)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border-none
                    ${paperSize === size 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                  `}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          
          {/* Quality */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Kvalita</label>
            <div className="flex gap-2">
              {[
                { id: 'draft' as Quality, name: 'Náhled', dpi: 72 },
                { id: 'standard' as Quality, name: 'Standard', dpi: 150 },
                { id: 'high' as Quality, name: 'Vysoká', dpi: 300 },
              ].map(q => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setQuality(q.id)}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer border-none
                    ${quality === q.id 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                  `}
                >
                  <div className="font-medium">{q.name}</div>
                  <div className="text-xs opacity-70">{q.dpi} DPI</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAnswerKey}
                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-300">Přidat klíč s odpověďmi</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-300">Zahrnout metadata</span>
            </label>
          </div>
        </div>
      )}
      
      {/* Preview info */}
      <div className="px-4 py-4 flex-1">
        <div className="bg-slate-900 rounded-xl p-4">
          <h4 className="text-sm font-medium text-white mb-2">Náhled exportu</h4>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Název:</span>
              <span className="text-slate-200">{worksheet.title || 'Nový pracovní list'}</span>
            </div>
            <div className="flex justify-between">
              <span>Bloků:</span>
              <span className="text-slate-200">{worksheet.blocks.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Formát:</span>
              <span className="text-slate-200">{selectedFormat.toUpperCase()}</span>
            </div>
            {selectedFormat === 'pdf' && (
              <>
                <div className="flex justify-between">
                  <span>Papír:</span>
                  <span className="text-slate-200">{paperSize.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kvalita:</span>
                  <span className="text-slate-200">{quality}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Export button */}
      <div className="px-4 py-4 border-t border-slate-700">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Exportuji...
            </>
          ) : (
            <>
              <Download size={18} />
              Exportovat {selectedFormat.toUpperCase()}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
