/**
 * FreeCanvasEditor - Mini Figma canvas editor pro volné plátno
 * 
 * Umožňuje:
 * - Vkládat a přesouvat objekty volně
 * - Kreslit tvary (obdélníky, kruhy, čáry)
 * - Psát text a volně ho přesouvat
 * - Vkládat obrázky a manipulovat s nimi
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Square,
  Circle,
  Minus,
  Type,
  ImageIcon,
  MousePointer2,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  X,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Maximize2,
  ArrowUpRight,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  FreeCanvasContent,
  CanvasObject,
  CanvasRectangle,
  CanvasEllipse,
  CanvasLine,
  CanvasText,
  CanvasImage,
  CanvasArrow,
} from '../../types/worksheet';

type ToolType = 'select' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'image';

interface FreeCanvasEditorProps {
  content: FreeCanvasContent;
  onUpdate: (content: FreeCanvasContent) => void;
  isEditing?: boolean;
  onEnterFullscreen?: () => void;
}

// Generate unique ID for objects
const generateObjectId = () => `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Color palette
const COLORS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB',
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
  '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#FFFFFF', 'transparent',
];

export function FreeCanvasEditor({
  content,
  onUpdate,
  isEditing = false,
  onEnterFullscreen,
}: FreeCanvasEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showFillPicker, setShowFillPicker] = useState(false);
  const [showStrokePicker, setShowStrokePicker] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const selectedObject = content.objects.find(obj => obj.id === selectedObjectId);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, [zoom]);

  // Update specific object
  const updateObject = useCallback((id: string, updates: Partial<CanvasObject>) => {
    const newObjects = content.objects.map(obj =>
      obj.id === id ? { ...obj, ...updates } as CanvasObject : obj
    );
    onUpdate({ ...content, objects: newObjects });
  }, [content, onUpdate]);

  // Add new object
  const addObject = useCallback((obj: CanvasObject) => {
    onUpdate({ ...content, objects: [...content.objects, obj] });
    setSelectedObjectId(obj.id);
  }, [content, onUpdate]);

  // Delete object
  const deleteObject = useCallback((id: string) => {
    onUpdate({ ...content, objects: content.objects.filter(obj => obj.id !== id) });
    if (selectedObjectId === id) setSelectedObjectId(null);
  }, [content, onUpdate, selectedObjectId]);

  // Duplicate object
  const duplicateObject = useCallback((id: string) => {
    const obj = content.objects.find(o => o.id === id);
    if (!obj) return;
    const newObj = {
      ...obj,
      id: generateObjectId(),
      x: obj.x + 20,
      y: obj.y + 20,
      zIndex: Math.max(...content.objects.map(o => o.zIndex), 0) + 1,
    };
    addObject(newObj as CanvasObject);
  }, [content.objects, addObject]);

  // Move object in z-order
  const moveObjectZ = useCallback((id: string, direction: 'up' | 'down') => {
    const obj = content.objects.find(o => o.id === id);
    if (!obj) return;
    
    const newZ = direction === 'up' 
      ? Math.max(...content.objects.map(o => o.zIndex), 0) + 1
      : Math.max(0, Math.min(...content.objects.map(o => o.zIndex)) - 1);
    
    updateObject(id, { zIndex: newZ });
  }, [content.objects, updateObject]);

  // Handle mouse down on canvas
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const coords = getCanvasCoords(e);

    if (activeTool === 'select') {
      // Find object under cursor (top-most first)
      const clickedObj = [...content.objects]
        .sort((a, b) => b.zIndex - a.zIndex)
        .find(obj => {
          return (
            coords.x >= obj.x &&
            coords.x <= obj.x + obj.width &&
            coords.y >= obj.y &&
            coords.y <= obj.y + obj.height
          );
        });

      if (clickedObj) {
        setSelectedObjectId(clickedObj.id);
        if (!clickedObj.locked) {
          setIsDragging(true);
          setDragOffset({
            x: coords.x - clickedObj.x,
            y: coords.y - clickedObj.y,
          });
        }
      } else {
        setSelectedObjectId(null);
      }
    } else if (activeTool === 'text') {
      // Create text immediately
      const newText: CanvasText = {
        id: generateObjectId(),
        type: 'text',
        x: coords.x,
        y: coords.y,
        width: 200,
        height: 30,
        zIndex: Math.max(...content.objects.map(o => o.zIndex), 0) + 1,
        text: 'Nový text',
        fontSize: 16,
        fill: '#000000',
      };
      addObject(newText);
      setEditingTextId(newText.id);
      setActiveTool('select');
    } else {
      // Start drawing shape
      setIsDrawing(true);
      setDrawStart(coords);
      setCurrentPos(coords);
    }
  }, [activeTool, content.objects, getCanvasCoords, addObject]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    setCurrentPos(coords);

    if (isDragging && selectedObjectId && dragOffset) {
      const obj = content.objects.find(o => o.id === selectedObjectId);
      if (obj && !obj.locked) {
        let newX = coords.x - dragOffset.x;
        let newY = coords.y - dragOffset.y;

        // Snap to grid
        if (content.showGrid && content.gridSize) {
          newX = Math.round(newX / content.gridSize) * content.gridSize;
          newY = Math.round(newY / content.gridSize) * content.gridSize;
        }

        updateObject(selectedObjectId, { x: newX, y: newY });
      }
    }

    if (isResizing && selectedObjectId) {
      const obj = content.objects.find(o => o.id === selectedObjectId);
      if (obj && !obj.locked) {
        let newWidth = Math.max(20, coords.x - obj.x);
        let newHeight = Math.max(20, coords.y - obj.y);

        if (content.showGrid && content.gridSize) {
          newWidth = Math.round(newWidth / content.gridSize) * content.gridSize;
          newHeight = Math.round(newHeight / content.gridSize) * content.gridSize;
        }

        updateObject(selectedObjectId, { width: newWidth, height: newHeight });
      }
    }
  }, [isDragging, isResizing, selectedObjectId, dragOffset, content, getCanvasCoords, updateObject]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDrawing && drawStart && currentPos) {
      const x = Math.min(drawStart.x, currentPos.x);
      const y = Math.min(drawStart.y, currentPos.y);
      const width = Math.abs(currentPos.x - drawStart.x);
      const height = Math.abs(currentPos.y - drawStart.y);

      // Only create if size is meaningful
      if (width > 10 || height > 10) {
        const baseObj = {
          id: generateObjectId(),
          x,
          y,
          width: Math.max(20, width),
          height: Math.max(20, height),
          zIndex: Math.max(...content.objects.map(o => o.zIndex), 0) + 1,
        };

        let newObj: CanvasObject | null = null;

        switch (activeTool) {
          case 'rectangle':
            newObj = {
              ...baseObj,
              type: 'rectangle',
              fill: '#3B82F6',
              stroke: '#1E40AF',
              strokeWidth: 2,
              borderRadius: 4,
            } as CanvasRectangle;
            break;
          case 'ellipse':
            newObj = {
              ...baseObj,
              type: 'ellipse',
              fill: '#22C55E',
              stroke: '#15803D',
              strokeWidth: 2,
            } as CanvasEllipse;
            break;
          case 'line':
            newObj = {
              ...baseObj,
              type: 'line',
              stroke: '#000000',
              strokeWidth: 2,
              points: [{ x: 0, y: 0 }, { x: width, y: height }],
            } as CanvasLine;
            break;
          case 'arrow':
            newObj = {
              ...baseObj,
              type: 'arrow',
              stroke: '#000000',
              strokeWidth: 2,
              arrowType: 'end',
            } as CanvasArrow;
            break;
        }

        if (newObj) {
          addObject(newObj);
        }
      }
    }

    setIsDrawing(false);
    setDrawStart(null);
    setIsDragging(false);
    setDragOffset(null);
    setIsResizing(false);
  }, [isDrawing, drawStart, currentPos, activeTool, content.objects, addObject]);

  // Render individual object
  const renderObject = (obj: CanvasObject) => {
    const isSelected = obj.id === selectedObjectId;
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: obj.x,
      top: obj.y,
      width: obj.width,
      height: obj.height,
      transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
      cursor: obj.locked ? 'not-allowed' : (activeTool === 'select' ? 'move' : 'crosshair'),
      outline: isSelected ? '2px solid #3B82F6' : 'none',
      outlineOffset: '2px',
      zIndex: obj.zIndex,
      boxSizing: 'border-box',
    };

    switch (obj.type) {
      case 'rectangle': {
        const rect = obj as CanvasRectangle;
        return (
          <div
            key={obj.id}
            style={{
              ...baseStyle,
              backgroundColor: rect.fill || 'transparent',
              border: rect.stroke ? `${rect.strokeWidth || 1}px solid ${rect.stroke}` : 'none',
              borderRadius: rect.borderRadius || 0,
            }}
          />
        );
      }
      case 'ellipse': {
        const ellipse = obj as CanvasEllipse;
        return (
          <div
            key={obj.id}
            style={{
              ...baseStyle,
              backgroundColor: ellipse.fill || 'transparent',
              border: ellipse.stroke ? `${ellipse.strokeWidth || 1}px solid ${ellipse.stroke}` : 'none',
              borderRadius: '50%',
            }}
          />
        );
      }
      case 'line': {
        const line = obj as CanvasLine;
        return (
          <svg
            key={obj.id}
            style={{ ...baseStyle, overflow: 'visible' }}
            width={obj.width}
            height={obj.height}
          >
            <line
              x1={0}
              y1={0}
              x2={obj.width}
              y2={obj.height}
              stroke={line.stroke}
              strokeWidth={line.strokeWidth}
              strokeDasharray={line.strokeStyle === 'dashed' ? '8,4' : line.strokeStyle === 'dotted' ? '2,2' : undefined}
            />
          </svg>
        );
      }
      case 'arrow': {
        const arrow = obj as CanvasArrow;
        const markerId = `arrow-marker-${obj.id}`;
        return (
          <svg
            key={obj.id}
            style={{ ...baseStyle, overflow: 'visible' }}
            width={obj.width}
            height={obj.height}
          >
            <defs>
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill={arrow.stroke} />
              </marker>
            </defs>
            <line
              x1={0}
              y1={0}
              x2={obj.width}
              y2={obj.height}
              stroke={arrow.stroke}
              strokeWidth={arrow.strokeWidth}
              markerEnd={`url(#${markerId})`}
            />
          </svg>
        );
      }
      case 'text': {
        const text = obj as CanvasText;
        const isEditingThis = editingTextId === obj.id;
        return (
          <div
            key={obj.id}
            style={{
              ...baseStyle,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: text.align === 'center' ? 'center' : text.align === 'right' ? 'flex-end' : 'flex-start',
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTextId(obj.id);
            }}
          >
            {isEditingThis ? (
              <textarea
                autoFocus
                value={text.text}
                onChange={(e) => updateObject(obj.id, { text: e.target.value })}
                onBlur={() => setEditingTextId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingTextId(null);
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: text.fontSize,
                  fontFamily: text.fontFamily || 'inherit',
                  color: text.fill,
                  fontWeight: text.bold ? 'bold' : 'normal',
                  fontStyle: text.italic ? 'italic' : 'normal',
                  textAlign: text.align || 'left',
                  background: 'rgba(255,255,255,0.9)',
                  border: '1px solid #3B82F6',
                  outline: 'none',
                  resize: 'none',
                  padding: 4,
                  borderRadius: 4,
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: text.fontSize,
                  fontFamily: text.fontFamily || 'inherit',
                  color: text.fill,
                  fontWeight: text.bold ? 'bold' : 'normal',
                  fontStyle: text.italic ? 'italic' : 'normal',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {text.text}
              </span>
            )}
          </div>
        );
      }
      case 'image': {
        const img = obj as CanvasImage;
        return (
          <div key={obj.id} style={{ ...baseStyle, overflow: 'hidden' }}>
            {img.url ? (
              <img
                src={img.url}
                alt={img.alt || ''}
                style={{ width: '100%', height: '100%', objectFit: img.objectFit || 'contain' }}
                draggable={false}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
              }}>
                <ImageIcon size={24} />
              </div>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  // Handle image upload
  const handleImageUpload = () => {
    const url = prompt('Vložte URL obrázku:');
    if (url) {
      const newImage: CanvasImage = {
        id: generateObjectId(),
        type: 'image',
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        zIndex: Math.max(...content.objects.map(o => o.zIndex), 0) + 1,
        url,
        objectFit: 'contain',
      };
      addObject(newImage);
      setActiveTool('select');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isEditing) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId && !editingTextId) {
          e.preventDefault();
          deleteObject(selectedObjectId);
        }
      }
      if (e.key === 'Escape') {
        setSelectedObjectId(null);
        setActiveTool('select');
        setEditingTextId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (selectedObjectId) {
          e.preventDefault();
          duplicateObject(selectedObjectId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, selectedObjectId, editingTextId, deleteObject, duplicateObject]);

  // Preview mode (non-editing)
  if (!isEditing) {
    // Canvas should fill block width, scale objects proportionally
    const canvasWidth = content.canvasWidth || 750;
    const canvasHeight = content.canvasHeight || 300;
    
    return (
      <div
        onClick={onEnterFullscreen}
        style={{
          width: '100%',
          height: canvasHeight,
          backgroundColor: content.backgroundColor || '#ffffff',
          borderRadius: 4,
          overflow: 'hidden',
          cursor: 'pointer',
          position: 'relative',
          border: '1px solid #e5e7eb',
        }}
      >
        {/* Render objects in preview - scaled to fit */}
        <div style={{ 
          position: 'relative', 
          width: canvasWidth, 
          height: canvasHeight,
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }}>
          {content.objects.map(renderObject)}
        </div>
        
        {/* Hover overlay */}
        <div 
          className="canvas-hover-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
        >
          <div style={{
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <Maximize2 size={16} />
            Upravit plátno
          </div>
        </div>
        
        {/* Empty state */}
        {content.objects.length === 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            gap: 8,
            backgroundColor: '#fafafa',
          }}>
            <Maximize2 size={28} style={{ color: '#d1d5db' }} />
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Klikni pro úpravu plátna</span>
          </div>
        )}
        
        <style>{`
          .canvas-hover-overlay:hover {
            opacity: 1 !important;
          }
        `}</style>
      </div>
    );
  }

  // Full editing mode
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'auto' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '10px 16px',
        backgroundColor: '#1f2937',
        borderBottom: '1px solid #374151',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Tool buttons */}
        <div style={{ display: 'flex', gap: 4, backgroundColor: '#111827', padding: 4, borderRadius: 8 }}>
          {[
            { tool: 'select' as ToolType, icon: MousePointer2, label: 'Vybrat (V)' },
            { tool: 'rectangle' as ToolType, icon: Square, label: 'Obdélník (R)' },
            { tool: 'ellipse' as ToolType, icon: Circle, label: 'Kruh (O)' },
            { tool: 'line' as ToolType, icon: Minus, label: 'Čára (L)' },
            { tool: 'arrow' as ToolType, icon: ArrowUpRight, label: 'Šipka (A)' },
            { tool: 'text' as ToolType, icon: Type, label: 'Text (T)' },
          ].map(({ tool, icon: Icon, label }) => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              title={label}
              style={{
                padding: 10,
                backgroundColor: activeTool === tool ? '#3B82F6' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                color: activeTool === tool ? 'white' : '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={20} />
            </button>
          ))}
          <button
            onClick={handleImageUpload}
            title="Vložit obrázek (I)"
            style={{
              padding: 10,
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#9CA3AF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImageIcon size={20} />
          </button>
        </div>

        <div style={{ width: 1, height: 32, backgroundColor: '#374151' }} />

        {/* Selected object actions */}
        {selectedObject && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* Color pickers for shapes */}
            {(selectedObject.type === 'rectangle' || selectedObject.type === 'ellipse') && (
              <>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowFillPicker(!showFillPicker); setShowStrokePicker(false); }}
                    title="Barva výplně"
                    style={{
                      padding: 6,
                      backgroundColor: 'transparent',
                      border: '1px solid #374151',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      backgroundColor: (selectedObject as CanvasRectangle).fill || 'transparent',
                      border: '2px solid #555',
                      borderRadius: 4,
                    }} />
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>Výplň</span>
                  </button>
                  {showFillPicker && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      padding: 8,
                      backgroundColor: '#1f2937',
                      borderRadius: 8,
                      border: '1px solid #374151',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: 4,
                      zIndex: 1000,
                    }}>
                      {COLORS.map((color) => (
                        <div
                          key={color}
                          onClick={() => {
                            updateObject(selectedObjectId!, { fill: color === 'transparent' ? undefined : color });
                            setShowFillPicker(false);
                          }}
                          style={{
                            width: 24,
                            height: 24,
                            backgroundColor: color === 'transparent' ? '#fff' : color,
                            border: (selectedObject as CanvasRectangle).fill === color ? '2px solid #3B82F6' : '1px solid #555',
                            borderRadius: 4,
                            cursor: 'pointer',
                            backgroundImage: color === 'transparent' 
                              ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' 
                              : undefined,
                            backgroundSize: '8px 8px',
                            backgroundPosition: '0 0, 4px 4px',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowStrokePicker(!showStrokePicker); setShowFillPicker(false); }}
                    title="Barva ohraničení"
                    style={{
                      padding: 6,
                      backgroundColor: 'transparent',
                      border: '1px solid #374151',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      backgroundColor: 'transparent',
                      border: `3px solid ${(selectedObject as CanvasRectangle).stroke || '#000'}`,
                      borderRadius: 4,
                    }} />
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>Tah</span>
                  </button>
                  {showStrokePicker && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      padding: 8,
                      backgroundColor: '#1f2937',
                      borderRadius: 8,
                      border: '1px solid #374151',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: 4,
                      zIndex: 1000,
                    }}>
                      {COLORS.map((color) => (
                        <div
                          key={color}
                          onClick={() => {
                            updateObject(selectedObjectId!, { stroke: color === 'transparent' ? undefined : color });
                            setShowStrokePicker(false);
                          }}
                          style={{
                            width: 24,
                            height: 24,
                            backgroundColor: color === 'transparent' ? '#fff' : color,
                            border: (selectedObject as CanvasRectangle).stroke === color ? '2px solid #3B82F6' : '1px solid #555',
                            borderRadius: 4,
                            cursor: 'pointer',
                            backgroundImage: color === 'transparent' 
                              ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)' 
                              : undefined,
                            backgroundSize: '8px 8px',
                            backgroundPosition: '0 0, 4px 4px',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ width: 1, height: 24, backgroundColor: '#374151', margin: '0 4px' }} />

            <button onClick={() => moveObjectZ(selectedObjectId!, 'up')} title="Posunout nahoru" style={{ padding: 6, backgroundColor: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#9CA3AF' }}>
              <ArrowUp size={18} />
            </button>
            <button onClick={() => moveObjectZ(selectedObjectId!, 'down')} title="Posunout dolů" style={{ padding: 6, backgroundColor: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#9CA3AF' }}>
              <ArrowDown size={18} />
            </button>
            <button onClick={() => duplicateObject(selectedObjectId!)} title="Duplikovat" style={{ padding: 6, backgroundColor: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#9CA3AF' }}>
              <Copy size={18} />
            </button>
            <button
              onClick={() => updateObject(selectedObjectId!, { locked: !selectedObject.locked })}
              title={selectedObject.locked ? 'Odemknout' : 'Zamknout'}
              style={{ padding: 6, backgroundColor: selectedObject.locked ? '#EF4444' : 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: selectedObject.locked ? 'white' : '#9CA3AF' }}
            >
              {selectedObject.locked ? <Lock size={18} /> : <Unlock size={18} />}
            </button>
            <button onClick={() => deleteObject(selectedObjectId!)} title="Smazat" style={{ padding: 6, backgroundColor: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#EF4444' }}>
              <Trash2 size={18} />
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Grid and zoom */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => onUpdate({ ...content, showGrid: !content.showGrid })}
            title="Mřížka"
            style={{
              padding: 6,
              backgroundColor: content.showGrid ? '#374151' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: content.showGrid ? '#10B981' : '#9CA3AF',
            }}
          >
            <Grid3X3 size={18} />
          </button>
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} style={{ padding: 6, backgroundColor: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#9CA3AF' }}>
            <ZoomOut size={18} />
          </button>
          <span style={{ fontSize: 12, color: '#9CA3AF', minWidth: 50, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(Math.min(2, zoom + 0.25))} style={{ padding: 6, backgroundColor: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#9CA3AF' }}>
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* Canvas area - jen samotný canvas bez zbytečného obalení */}
      <div style={{
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            width: content.canvasWidth || 700,
            height: content.canvasHeight || 400,
            backgroundColor: content.backgroundColor || '#ffffff',
            position: 'relative',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
            borderRadius: 4,
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            cursor: activeTool === 'select' ? 'default' : 'crosshair',
            backgroundImage: content.showGrid
              ? `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`
              : undefined,
            backgroundSize: content.showGrid ? `${content.gridSize || 20}px ${content.gridSize || 20}px` : undefined,
          }}
        >
          {/* Render all objects sorted by zIndex */}
          {[...content.objects]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(renderObject)}

          {/* Resize handle for selected object */}
          {selectedObject && !selectedObject.locked && (
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsResizing(true);
              }}
              style={{
                position: 'absolute',
                left: selectedObject.x + selectedObject.width - 5,
                top: selectedObject.y + selectedObject.height - 5,
                width: 10,
                height: 10,
                backgroundColor: '#3B82F6',
                borderRadius: '50%',
                cursor: 'se-resize',
                zIndex: 10000,
                border: '2px solid white',
              }}
            />
          )}

          {/* Drawing preview */}
          {isDrawing && drawStart && currentPos && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(drawStart.x, currentPos.x),
                top: Math.min(drawStart.y, currentPos.y),
                width: Math.abs(currentPos.x - drawStart.x),
                height: Math.abs(currentPos.y - drawStart.y),
                border: '2px dashed #3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                pointerEvents: 'none',
                borderRadius: activeTool === 'ellipse' ? '50%' : 4,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
