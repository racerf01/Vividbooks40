/**
 * ProSettingsPanel - Dark mode settings panel for PRO editor
 */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Worksheet, Subject, Grade } from '../../types/worksheet';

interface ProSettingsPanelProps {
  worksheet: Worksheet;
  onUpdateWorksheet: (updates: Partial<Worksheet>) => void;
}

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: 'matematika', label: 'Matematika' },
  { value: 'fyzika', label: 'Fyzika' },
  { value: 'chemie', label: 'Chemie' },
  { value: 'prirodopis', label: 'Přírodověda' },
  { value: 'cestina', label: 'Český jazyk' },
  { value: 'anglictina', label: 'Angličtina' },
  { value: 'dejepis', label: 'Dějepis' },
  { value: 'zemepis', label: 'Zeměpis' },
  { value: 'other', label: 'Jiný' },
];

const GRADES: Grade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  backgroundColor: '#334155',
  border: '1px solid #475569',
  borderRadius: '6px',
  color: '#E5E5E5',
  fontSize: '12px',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 500,
  color: '#808080',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export function ProSettingsPanel({ worksheet, onUpdateWorksheet }: ProSettingsPanelProps) {
  const [keywordInput, setKeywordInput] = useState('');

  const addKeyword = () => {
    if (keywordInput.trim() && !worksheet.metadata.keywords?.includes(keywordInput.trim())) {
      onUpdateWorksheet({
        metadata: {
          ...worksheet.metadata,
          keywords: [...(worksheet.metadata.keywords || []), keywordInput.trim()],
        },
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    onUpdateWorksheet({
      metadata: {
        ...worksheet.metadata,
        keywords: (worksheet.metadata.keywords || []).filter(k => k !== keyword),
      },
    });
  };

  return (
    <div style={{ 
      padding: '12px', 
      height: '100%', 
      overflowY: 'auto', 
      backgroundColor: '#1e293b',
    }}>
      <h2 style={{ 
        fontSize: '11px', 
        fontWeight: 600, 
        color: '#808080', 
        textTransform: 'uppercase', 
        letterSpacing: '0.5px',
        marginBottom: '16px',
      }}>
        Nastavení listu
      </h2>

      {/* Title */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Název</label>
        <input
          type="text"
          value={worksheet.title}
          onChange={(e) => onUpdateWorksheet({ title: e.target.value })}
          placeholder="Název pracovního listu"
          style={inputStyle}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Popis</label>
        <textarea
          value={worksheet.metadata.description || ''}
          onChange={(e) => onUpdateWorksheet({ 
            metadata: { ...worksheet.metadata, description: e.target.value } 
          })}
          placeholder="Krátký popis..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Subject */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Předmět</label>
        <select
          value={worksheet.metadata.subject || ''}
          onChange={(e) => onUpdateWorksheet({ 
            metadata: { ...worksheet.metadata, subject: e.target.value as Subject } 
          })}
          style={inputStyle}
        >
          <option value="">Vyberte předmět</option>
          {SUBJECTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Grade */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Ročník</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {GRADES.map((grade) => (
            <button
              key={grade}
              onClick={() => onUpdateWorksheet({ 
                metadata: { ...worksheet.metadata, grade } 
              })}
              style={{
                padding: '6px 10px',
                backgroundColor: worksheet.metadata.grade === grade ? '#5C5CFF' : '#334155',
                color: worksheet.metadata.grade === grade ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 500,
              }}
            >
              {grade}.
            </button>
          ))}
        </div>
      </div>

      {/* Time */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Časová náročnost (min)</label>
        <input
          type="number"
          value={worksheet.metadata.estimatedTime || ''}
          onChange={(e) => onUpdateWorksheet({ 
            metadata: { ...worksheet.metadata, estimatedTime: parseInt(e.target.value) || undefined } 
          })}
          placeholder="např. 15"
          min={1}
          max={180}
          style={{ ...inputStyle, width: '100px' }}
        />
      </div>

      {/* Keywords */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Klíčová slova</label>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Přidat klíčové slovo"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={addKeyword}
            style={{
              padding: '8px',
              backgroundColor: '#334155',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {(worksheet.metadata.keywords || []).map((keyword) => (
            <span
              key={keyword}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                backgroundColor: '#334155',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#E5E5E5',
              }}
            >
              {keyword}
              <button
                onClick={() => removeKeyword(keyword)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#808080',
                  display: 'flex',
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
