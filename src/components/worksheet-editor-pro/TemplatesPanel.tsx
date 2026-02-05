/**
 * TemplatesPanel - Template management for Pro editor
 * Save, load, and apply worksheet templates
 */

import { useState } from 'react';
import { 
  Layout, 
  Plus,
  Search,
  Star,
  Clock,
  Trash2,
  Download,
  Upload,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  blocksCount: number;
  createdAt: string;
  isFavorite: boolean;
}

interface TemplatesPanelProps {
  onApplyTemplate: (template: Template) => void;
}

// Mock templates - later will be from storage
const MOCK_TEMPLATES: Template[] = [
  {
    id: '1',
    name: 'Prázdný pracovní list',
    description: 'Základní struktura s hlavičkou a prázdným obsahem',
    category: 'Základní',
    blocksCount: 2,
    createdAt: '2024-01-15',
    isFavorite: true,
  },
  {
    id: '2',
    name: 'Čtení s porozuměním',
    description: 'Text s otázkami na porozumění',
    category: 'Čeština',
    blocksCount: 5,
    createdAt: '2024-01-10',
    isFavorite: false,
  },
  {
    id: '3',
    name: 'Matematické cvičení',
    description: 'Série příkladů s prostorem pro řešení',
    category: 'Matematika',
    blocksCount: 8,
    createdAt: '2024-01-08',
    isFavorite: true,
  },
  {
    id: '4',
    name: 'Test s výběrem odpovědí',
    description: 'Multiple-choice otázky',
    category: 'Testy',
    blocksCount: 10,
    createdAt: '2024-01-05',
    isFavorite: false,
  },
];

export function TemplatesPanel({ onApplyTemplate }: TemplatesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  const categories = [...new Set(MOCK_TEMPLATES.map(t => t.category))];
  
  const filteredTemplates = MOCK_TEMPLATES.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedCategory && t.category !== selectedCategory) {
      return false;
    }
    if (showFavoritesOnly && !t.isFavorite) {
      return false;
    }
    return true;
  });
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Layout size={20} />
          Šablony
        </h3>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Hledat šablony..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 outline-none focus:border-blue-500"
          />
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border-none
              ${showFavoritesOnly ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'}
            `}
          >
            <Star size={12} />
            Oblíbené
          </button>
          
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border-none
                ${selectedCategory === cat ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-300'}
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      
      {/* Actions */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer border-none"
        >
          <Plus size={14} />
          Uložit jako šablonu
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors cursor-pointer border-none"
        >
          <Upload size={14} />
          Importovat
        </button>
      </div>
      
      {/* Templates list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8">
            <Layout size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Žádné šablony nenalezeny</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <div
              key={template.id}
              className="bg-slate-900 rounded-xl p-4 hover:bg-slate-700/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    {template.name}
                    {template.isFavorite && (
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                    )}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">{template.description}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="px-2 py-0.5 bg-slate-800 rounded">{template.category}</span>
                  <span>{template.blocksCount} bloků</span>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onApplyTemplate(template)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer border-none"
                  >
                    Použít
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-slate-600 transition-colors cursor-pointer bg-transparent border-none"
                  >
                    <Download size={14} className="text-slate-400" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-slate-600 transition-colors cursor-pointer bg-transparent border-none"
                  >
                    <Trash2 size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
