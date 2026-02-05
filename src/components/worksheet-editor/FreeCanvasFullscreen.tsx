/**
 * FreeCanvasFullscreen - Čistý canvas editor (Canva/Figma style)
 * 
 * Profesionální transformační systém s podporou:
 * - Shift = zachování poměru stran při resize, omezení na osu při move
 * - Alt = transformace od středu
 * - Arrow keys = posun o 1px (Shift + Arrow = 10px)
 * - Shift při rotaci = přichycení k 15°
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, Square, Circle, Type, Image as ImageIcon, Trash2, Copy, Lock, Unlock, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { FreeCanvasContent, CanvasObject, CanvasRectangle, CanvasEllipse, CanvasText, CanvasImage, CanvasGroup } from '../../types/worksheet';
import { TransformableObject } from './canvas/TransformableObject';
import { TransformState } from './canvas/useCanvasTransform';

const CONTENT_WIDTH = 750;

interface FreeCanvasFullscreenProps {
  content: FreeCanvasContent;
  onUpdate: (content: FreeCanvasContent) => void;
  onClose: () => void;
  blockId: string;
  blockWidth?: number;
}

export function FreeCanvasFullscreen({
  content,
  onUpdate,
  onClose,
  blockId,
  blockWidth = CONTENT_WIDTH,
}: FreeCanvasFullscreenProps) {
  const canvasWidth = blockWidth;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  
  // Marquee selection state
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const selectedObjects = content.objects.filter(obj => selectedObjectIds.includes(obj.id));
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  
  // Get unique colors from selected objects for "Selection colors" panel
  const selectionColors = React.useMemo(() => {
    const colors: { color: string; type: 'fill' | 'stroke'; count: number }[] = [];
    selectedObjects.forEach(obj => {
      if (obj.type === 'rectangle' || obj.type === 'ellipse') {
        const shape = obj as CanvasRectangle | CanvasEllipse;
        if (shape.fill) {
          const existing = colors.find(c => c.color === shape.fill && c.type === 'fill');
          if (existing) existing.count++;
          else colors.push({ color: shape.fill, type: 'fill', count: 1 });
        }
        if (shape.stroke) {
          const existing = colors.find(c => c.color === shape.stroke && c.type === 'stroke');
          if (existing) existing.count++;
          else colors.push({ color: shape.stroke, type: 'stroke', count: 1 });
        }
      }
      if (obj.type === 'text') {
        const text = obj as CanvasText;
        if (text.fill) {
          const existing = colors.find(c => c.color === text.fill && c.type === 'fill');
          if (existing) existing.count++;
          else colors.push({ color: text.fill, type: 'fill', count: 1 });
        }
      }
    });
    return colors;
  }, [selectedObjects]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.classList.add('canvas-fullscreen-active');
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('canvas-fullscreen-active');
    };
  }, []);

  // Update object
  const updateObject = useCallback((id: string, updates: Partial<CanvasObject>) => {
    const newObjects = content.objects.map(obj =>
      obj.id === id ? { ...obj, ...updates } as CanvasObject : obj
    );
    onUpdate({ ...content, objects: newObjects });
  }, [content, onUpdate]);

  // Handle transform from TransformableObject
  const handleTransform = useCallback((objId: string, state: TransformState) => {
    updateObject(objId, {
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      // rotation: state.rotation, // TODO: přidat rotation do typu objektů
    });
  }, [updateObject]);

  // Render object content (inside TransformableObject wrapper)
  const renderObjectContent = (obj: CanvasObject) => {
    switch (obj.type) {
      case 'rectangle': {
        const rect = obj as CanvasRectangle;
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: rect.fill || 'transparent',
              border: rect.stroke ? `${rect.strokeWidth || 2}px solid ${rect.stroke}` : 'none',
              borderRadius: rect.borderRadius || 0,
              boxSizing: 'border-box',
            }}
          />
        );
      }
      case 'ellipse': {
        const ellipse = obj as CanvasEllipse;
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: ellipse.fill || 'transparent',
              border: ellipse.stroke ? `${ellipse.strokeWidth || 2}px solid ${ellipse.stroke}` : 'none',
              borderRadius: '50%',
              boxSizing: 'border-box',
            }}
          />
        );
      }
      case 'text': {
        const text = obj as CanvasText;
        return (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: text.align === 'center' ? 'center' : text.align === 'right' ? 'flex-end' : 'flex-start',
              padding: 4,
              boxSizing: 'border-box',
            }}
          >
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
          </div>
        );
      }
      case 'image': {
        const img = obj as CanvasImage;
        return (
          <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
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
                fontSize: 12,
              }}>
                Klikni pro nahrání
              </div>
            )}
          </div>
        );
      }
      case 'group': {
        const group = obj as CanvasGroup;
        // Render children inside the group
        const childObjects = content.objects.filter(o => group.children.includes(o.id));
        return (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {childObjects.map(child => (
              <div
                key={child.id}
                style={{
                  position: 'absolute',
                  left: child.x,
                  top: child.y,
                  width: child.width,
                  height: child.height,
                }}
              >
                {renderObjectContent(child)}
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  // Add object helper
  const addObject = useCallback((type: 'rectangle' | 'ellipse' | 'text' | 'image') => {
    const newObject: CanvasObject = {
      id: `obj-${Date.now()}`,
      type,
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      width: type === 'text' ? 150 : 100,
      height: type === 'text' ? 40 : 100,
      zIndex: content.objects.length + 1,
      locked: false,
      ...(type === 'rectangle' && { fill: '#3B82F6', stroke: '', strokeWidth: 2, borderRadius: 0 }),
      ...(type === 'ellipse' && { fill: '#10B981', stroke: '', strokeWidth: 2 }),
      ...(type === 'text' && { text: 'Text', fontSize: 16, fontFamily: 'inherit', fill: '#000000', bold: false, italic: false, align: 'left' as const }),
      ...(type === 'image' && { url: '', alt: '', objectFit: 'contain' as const }),
    } as CanvasObject;
    onUpdate({ ...content, objects: [...content.objects, newObject] });
    setSelectedObjectId(newObject.id);
  }, [content, onUpdate]);

  // Delete selected objects
  const deleteSelected = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    onUpdate({ ...content, objects: content.objects.filter(obj => !selectedObjectIds.includes(obj.id)) });
    setSelectedObjectIds([]);
  }, [selectedObjectIds, content, onUpdate]);

  // Duplicate selected objects
  const duplicateSelected = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const newObjects: CanvasObject[] = [];
    const newIds: string[] = [];
    selectedObjectIds.forEach((id, i) => {
      const obj = content.objects.find(o => o.id === id);
      if (obj) {
        const newId = `obj-${Date.now()}-${i}`;
        newObjects.push({ ...obj, id: newId, x: obj.x + 20, y: obj.y + 20, zIndex: content.objects.length + i + 1 } as CanvasObject);
        newIds.push(newId);
      }
    });
    onUpdate({ ...content, objects: [...content.objects, ...newObjects] });
    setSelectedObjectIds(newIds);
  }, [selectedObjectIds, content, onUpdate]);

  // Duplicate object by ID (for Alt + drag)
  const duplicateObject = useCallback((objId: string) => {
    const obj = content.objects.find(o => o.id === objId);
    if (!obj) return;
    const newObj = { ...obj, id: `obj-${Date.now()}`, x: obj.x + 20, y: obj.y + 20, zIndex: content.objects.length + 1 };
    onUpdate({ ...content, objects: [...content.objects, newObj] });
    setSelectedObjectIds([newObj.id]);
  }, [content, onUpdate]);

  // Toggle lock for selected objects
  const toggleLock = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const anyUnlocked = selectedObjects.some(obj => !obj.locked);
    const newObjects = content.objects.map(obj => 
      selectedObjectIds.includes(obj.id) ? { ...obj, locked: anyUnlocked } : obj
    );
    onUpdate({ ...content, objects: newObjects as CanvasObject[] });
  }, [selectedObjectIds, selectedObjects, content, onUpdate]);

  // Move layer for first selected object
  const moveLayer = useCallback((direction: 'up' | 'down') => {
    if (selectedObjectIds.length === 0) return;
    const obj = content.objects.find(o => o.id === selectedObjectIds[0]);
    if (!obj) return;
    const sorted = [...content.objects].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex(o => o.id === selectedObjectIds[0]);
    if (direction === 'up' && idx < sorted.length - 1) {
      const newZIndex = sorted[idx + 1].zIndex;
      sorted[idx + 1].zIndex = obj.zIndex;
      obj.zIndex = newZIndex;
    } else if (direction === 'down' && idx > 0) {
      const newZIndex = sorted[idx - 1].zIndex;
      sorted[idx - 1].zIndex = obj.zIndex;
      obj.zIndex = newZIndex;
    }
    onUpdate({ ...content, objects: sorted });
  }, [selectedObjectIds, content, onUpdate]);

  // Change color for all selected objects
  const changeSelectionColor = useCallback((oldColor: string, newColor: string, type: 'fill' | 'stroke') => {
    const newObjects = content.objects.map(obj => {
      if (!selectedObjectIds.includes(obj.id)) return obj;
      if (obj.type === 'rectangle' || obj.type === 'ellipse') {
        const shape = obj as CanvasRectangle | CanvasEllipse;
        if (type === 'fill' && shape.fill === oldColor) {
          return { ...shape, fill: newColor };
        }
        if (type === 'stroke' && shape.stroke === oldColor) {
          return { ...shape, stroke: newColor };
        }
      }
      if (obj.type === 'text' && type === 'fill') {
        const text = obj as CanvasText;
        if (text.fill === oldColor) {
          return { ...text, fill: newColor };
        }
      }
      return obj;
    });
    onUpdate({ ...content, objects: newObjects as CanvasObject[] });
  }, [selectedObjectIds, content, onUpdate]);

  // Reset rotation
  const resetRotation = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    // TODO: když přidáme rotation do objektů
  }, [selectedObjectIds]);

  // Group selected objects (Ctrl+G)
  const groupSelected = useCallback(() => {
    if (selectedObjectIds.length < 2) return;
    
    // Get selected objects
    const selectedObjs = content.objects.filter(obj => selectedObjectIds.includes(obj.id));
    if (selectedObjs.length < 2) return;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedObjs.forEach(obj => {
      minX = Math.min(minX, obj.x);
      minY = Math.min(minY, obj.y);
      maxX = Math.max(maxX, obj.x + obj.width);
      maxY = Math.max(maxY, obj.y + obj.height);
    });

    // Create group object
    const groupId = `group-${Date.now()}`;
    const group: CanvasGroup = {
      id: groupId,
      type: 'group',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      zIndex: Math.max(...selectedObjs.map(o => o.zIndex)) + 1,
      locked: false,
      children: selectedObjectIds,
    };

    // Update children positions to be relative to group
    const updatedObjects = content.objects.map(obj => {
      if (selectedObjectIds.includes(obj.id)) {
        return { ...obj, x: obj.x - minX, y: obj.y - minY };
      }
      return obj;
    });

    onUpdate({ ...content, objects: [...updatedObjects, group] });
    setSelectedObjectIds([groupId]);
  }, [selectedObjectIds, content, onUpdate]);

  // Ungroup selected group (Ctrl+Shift+G)
  const ungroupSelected = useCallback(() => {
    if (selectedObjectIds.length !== 1) return;
    
    const group = content.objects.find(obj => obj.id === selectedObjectIds[0]);
    if (!group || group.type !== 'group') return;

    const groupObj = group as CanvasGroup;
    
    // Get children and update their positions back to absolute
    const childIds = groupObj.children;
    const updatedObjects = content.objects
      .filter(obj => obj.id !== groupObj.id) // Remove group
      .map(obj => {
        if (childIds.includes(obj.id)) {
          return { ...obj, x: obj.x + groupObj.x, y: obj.y + groupObj.y };
        }
        return obj;
      });

    onUpdate({ ...content, objects: updatedObjects });
    setSelectedObjectIds(childIds);
  }, [selectedObjectIds, content, onUpdate]);

  // Check if selection contains a group
  const hasGroupSelected = useMemo(() => {
    return selectedObjects.some(obj => obj.type === 'group');
  }, [selectedObjects]);

  // Check if can group (2+ objects selected, none are groups)
  const canGroup = useMemo(() => {
    return selectedObjectIds.length >= 2 && !hasGroupSelected;
  }, [selectedObjectIds.length, hasGroupSelected]);

  // Clipboard state for internal copy/paste
  const [clipboard, setClipboard] = useState<CanvasObject[]>([]);
  
  // Debug state
  const [showDebug, setShowDebug] = useState(false);
  const [debugClipboard, setDebugClipboard] = useState<string>('');

  // Copy selected objects to clipboard
  const copySelected = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    const objectsToCopy = content.objects.filter(obj => selectedObjectIds.includes(obj.id));
    setClipboard(objectsToCopy);
    
    // Also copy to system clipboard as JSON for cross-tab/window paste
    const jsonData = JSON.stringify({ type: 'vividbooks-canvas', objects: objectsToCopy });
    navigator.clipboard.writeText(jsonData).catch(() => {});
  }, [selectedObjectIds, content.objects]);

  // Cut selected objects
  const cutSelected = useCallback(() => {
    copySelected();
    deleteSelected();
  }, [copySelected, deleteSelected]);

  // Parse SVG and convert to canvas objects
  const parseSvgToObjects = useCallback((svgString: string, offsetX: number = 50, offsetY: number = 50): CanvasObject[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return [];

    const objects: CanvasObject[] = [];
    const baseZIndex = Math.max(0, ...content.objects.map(o => o.zIndex)) + 1;

    // Get SVG viewBox or dimensions
    const viewBox = svg.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 100, 100];
    const svgWidth = parseFloat(svg.getAttribute('width') || String(viewBox[2])) || 100;
    const svgHeight = parseFloat(svg.getAttribute('height') || String(viewBox[3])) || 100;
    const scale = Math.min(200 / svgWidth, 200 / svgHeight, 1);

    // Parse rectangles
    svg.querySelectorAll('rect').forEach((rect, i) => {
      const x = parseFloat(rect.getAttribute('x') || '0') * scale + offsetX;
      const y = parseFloat(rect.getAttribute('y') || '0') * scale + offsetY;
      const width = parseFloat(rect.getAttribute('width') || '50') * scale;
      const height = parseFloat(rect.getAttribute('height') || '50') * scale;
      const fill = rect.getAttribute('fill') || '#3B82F6';
      const stroke = rect.getAttribute('stroke') || '';
      const strokeWidth = parseFloat(rect.getAttribute('stroke-width') || '0');
      const rx = parseFloat(rect.getAttribute('rx') || '0') * scale;

      objects.push({
        id: `svg-rect-${Date.now()}-${i}`,
        type: 'rectangle',
        x, y, width, height,
        zIndex: baseZIndex + i,
        locked: false,
        fill: fill === 'none' ? 'transparent' : fill,
        stroke: stroke === 'none' ? '' : stroke,
        strokeWidth,
        borderRadius: rx,
      } as CanvasRectangle);
    });

    // Parse circles/ellipses
    svg.querySelectorAll('circle, ellipse').forEach((el, i) => {
      let cx: number, cy: number, rx: number, ry: number;
      if (el.tagName === 'circle') {
        cx = parseFloat(el.getAttribute('cx') || '0') * scale;
        cy = parseFloat(el.getAttribute('cy') || '0') * scale;
        const r = parseFloat(el.getAttribute('r') || '25') * scale;
        rx = ry = r;
      } else {
        cx = parseFloat(el.getAttribute('cx') || '0') * scale;
        cy = parseFloat(el.getAttribute('cy') || '0') * scale;
        rx = parseFloat(el.getAttribute('rx') || '25') * scale;
        ry = parseFloat(el.getAttribute('ry') || '25') * scale;
      }
      const fill = el.getAttribute('fill') || '#10B981';
      const stroke = el.getAttribute('stroke') || '';
      const strokeWidth = parseFloat(el.getAttribute('stroke-width') || '0');

      objects.push({
        id: `svg-ellipse-${Date.now()}-${i}`,
        type: 'ellipse',
        x: cx - rx + offsetX,
        y: cy - ry + offsetY,
        width: rx * 2,
        height: ry * 2,
        zIndex: baseZIndex + objects.length,
        locked: false,
        fill: fill === 'none' ? 'transparent' : fill,
        stroke: stroke === 'none' ? '' : stroke,
        strokeWidth,
      } as CanvasEllipse);
    });

    // Parse text elements
    svg.querySelectorAll('text').forEach((text, i) => {
      const x = parseFloat(text.getAttribute('x') || '0') * scale + offsetX;
      const y = parseFloat(text.getAttribute('y') || '0') * scale + offsetY;
      const content = text.textContent || 'Text';
      const fill = text.getAttribute('fill') || '#000000';
      const fontSize = parseFloat(text.getAttribute('font-size') || '16') * scale;

      objects.push({
        id: `svg-text-${Date.now()}-${i}`,
        type: 'text',
        x, y,
        width: Math.max(100, content.length * fontSize * 0.6),
        height: fontSize * 1.5,
        zIndex: baseZIndex + objects.length,
        locked: false,
        content,
        fontSize: Math.round(fontSize),
        fontFamily: 'Inter, sans-serif',
        color: fill,
        align: 'left',
      } as CanvasText);
    });

    // If no specific shapes found, create the whole SVG as an image
    if (objects.length === 0) {
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      objects.push({
        id: `svg-image-${Date.now()}`,
        type: 'image',
        x: offsetX,
        y: offsetY,
        width: svgWidth * scale,
        height: svgHeight * scale,
        zIndex: baseZIndex,
        locked: false,
        url,
        objectFit: 'contain',
      } as CanvasImage);
    }

    return objects;
  }, [content.objects]);

  // Paste from internal clipboard (fallback)
  const pasteInternal = useCallback(() => {
    if (clipboard.length > 0) {
      const baseZIndex = Math.max(0, ...content.objects.map(o => o.zIndex)) + 1;
      const pastedObjects = clipboard.map((obj, i) => ({
        ...obj,
        id: `paste-${Date.now()}-${i}`,
        x: obj.x + 20,
        y: obj.y + 20,
        zIndex: baseZIndex + i,
      }));
      onUpdate({ ...content, objects: [...content.objects, ...pastedObjects] });
      setSelectedObjectIds(pastedObjects.map(o => o.id));
    }
  }, [clipboard, content, onUpdate]);

  // Handle drag and drop
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Get drop position relative to canvas
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const dropX = canvasRect ? e.clientX - canvasRect.left : 50;
    const dropY = canvasRect ? e.clientY - canvasRect.top : 50;

    files.forEach((file, index) => {
      // Handle SVG files
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const svgString = event.target?.result as string;
          if (svgString) {
            const newObjects = parseSvgToObjects(svgString, dropX + index * 20, dropY + index * 20);
            if (newObjects.length > 0) {
              onUpdate({ ...content, objects: [...content.objects, ...newObjects] });
              setSelectedObjectIds(newObjects.map(o => o.id));
            }
          }
        };
        reader.readAsText(file);
        return;
      }

      // Handle image files (PNG, JPG, GIF, WebP)
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        img.onload = () => {
          const maxSize = 300;
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

          const newObject: CanvasImage = {
            id: `drop-img-${Date.now()}-${index}`,
            type: 'image',
            x: dropX + index * 20,
            y: dropY + index * 20,
            width: img.width * scale,
            height: img.height * scale,
            zIndex: Math.max(0, ...content.objects.map(o => o.zIndex)) + 1 + index,
            locked: false,
            url,
            objectFit: 'contain',
          };

          onUpdate({ ...content, objects: [...content.objects, newObject] });
          setSelectedObjectIds([newObject.id]);
        };
      }
    });
  }, [content, onUpdate, parseSvgToObjects]);

  // Handle paste event from document (works better for images/files)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Skip if in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) {
        pasteInternal();
        return;
      }

      // Check for images
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.src = url;
          
          img.onload = () => {
            const maxSize = 300;
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            
            const newObject: CanvasImage = {
              id: `paste-img-${Date.now()}`,
              type: 'image',
              x: 50,
              y: 50,
              width: img.width * scale,
              height: img.height * scale,
              zIndex: Math.max(0, ...content.objects.map(o => o.zIndex)) + 1,
              locked: false,
              url,
              objectFit: 'contain',
            };
            
            onUpdate({ ...content, objects: [...content.objects, newObject] });
            setSelectedObjectIds([newObject.id]);
          };
          return;
        }
      }

      // Check for text (SVG or JSON)
      const textItem = Array.from(items).find(item => item.type === 'text/plain');
      if (textItem) {
        textItem.getAsString((text) => {
          // Try SVG
          if (text.includes('<svg') && text.includes('</svg>')) {
            e.preventDefault();
            const newObjects = parseSvgToObjects(text);
            if (newObjects.length > 0) {
              onUpdate({ ...content, objects: [...content.objects, ...newObjects] });
              setSelectedObjectIds(newObjects.map(o => o.id));
              return;
            }
          }

          // Try our JSON format
          try {
            const data = JSON.parse(text);
            if (data.type === 'vividbooks-canvas' && Array.isArray(data.objects)) {
              e.preventDefault();
              const baseZIndex = Math.max(0, ...content.objects.map(o => o.zIndex)) + 1;
              const pastedObjects = data.objects.map((obj: CanvasObject, i: number) => ({
                ...obj,
                id: `paste-${Date.now()}-${i}`,
                x: obj.x + 20,
                y: obj.y + 20,
                zIndex: baseZIndex + i,
              }));
              onUpdate({ ...content, objects: [...content.objects, ...pastedObjects] });
              setSelectedObjectIds(pastedObjects.map((o: CanvasObject) => o.id));
              return;
            }
          } catch {
            // Not our format
          }

          // Plain text - create text object
          if (text.trim() && text.length < 500) {
            e.preventDefault();
            const newObject: CanvasText = {
              id: `paste-text-${Date.now()}`,
              type: 'text',
              x: 50,
              y: 50,
              width: Math.min(300, text.length * 10),
              height: 40,
              zIndex: Math.max(0, ...content.objects.map(o => o.zIndex)) + 1,
              locked: false,
              content: text,
              fontSize: 16,
              fontFamily: 'Inter, sans-serif',
              color: '#000000',
              align: 'left',
            };
            onUpdate({ ...content, objects: [...content.objects, newObject] });
            setSelectedObjectIds([newObject.id]);
          }
        });
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [content, onUpdate, parseSvgToObjects, pasteInternal]);

  // Handle keyboard shortcuts (must be after groupSelected/ungroupSelected definitions)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close context menu on any key
      setContextMenu(null);

      if (e.key === 'Escape') {
        if (selectedObjectIds.length > 0) {
          setSelectedObjectIds([]);
        } else {
          onClose();
        }
      }

      // Delete selected objects
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectIds.length > 0) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        onUpdate({ ...content, objects: content.objects.filter(obj => !selectedObjectIds.includes(obj.id)) });
        setSelectedObjectIds([]);
      }

      // Ctrl+G = Group
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
      }

      // Ctrl+Shift+G = Ungroup
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && e.shiftKey) {
        e.preventDefault();
        ungroupSelected();
      }

      // Ctrl+D = Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }

      // Ctrl+C = Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          copySelected();
        }
      }

      // Ctrl+X = Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          cutSelected();
        }
      }

      // Ctrl+V = Paste (handled by paste event listener, but trigger internal paste as fallback)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        // Let the paste event handler deal with it, but provide fallback
        setTimeout(() => pasteInternal(), 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedObjectIds, content, onUpdate, groupSelected, ungroupSelected, duplicateSelected, copySelected, cutSelected, pasteInternal]);

  const toolBtnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '12px 8px',
    backgroundColor: '#374151',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    color: '#e5e7eb',
    transition: 'all 0.15s',
  };

  const actionBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    backgroundColor: '#374151',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: '#9ca3af',
    transition: 'all 0.15s',
  };

  return createPortal(
    <div
      className="canvas-fullscreen-root"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1e293b',
        zIndex: 99999,
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* Left Sidebar - Tools */}
      <div
        style={{
          width: 280,
          height: '100%',
          backgroundColor: '#111827',
          borderRight: '1px solid #374151',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: 16, borderBottom: '1px solid #374151' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#e5e7eb' }}>
            Volné plátno
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
            {content.objects.length} objektů
          </p>
        </div>

        {/* Tools */}
        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          <label style={{ display: 'block', marginBottom: 10, fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em' }}>
            VLOŽIT
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => addObject('rectangle')} style={toolBtnStyle}>
              <Square size={24} />
              <span style={{ fontSize: 11 }}>Obdélník</span>
            </button>
            <button onClick={() => addObject('ellipse')} style={toolBtnStyle}>
              <Circle size={24} />
              <span style={{ fontSize: 11 }}>Kruh</span>
            </button>
            <button onClick={() => addObject('text')} style={toolBtnStyle}>
              <Type size={24} />
              <span style={{ fontSize: 11 }}>Text</span>
            </button>
            <button onClick={() => addObject('image')} style={toolBtnStyle}>
              <ImageIcon size={24} />
              <span style={{ fontSize: 11 }}>Obrázek</span>
            </button>
          </div>

          {/* Keyboard shortcuts info */}
          <div style={{ marginTop: 16, padding: 12, backgroundColor: '#1f2937', borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>KLÁVESOVÉ ZKRATKY</div>
            <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
              <div><kbd style={{ backgroundColor: '#374151', padding: '1px 4px', borderRadius: 3, marginRight: 4, fontSize: 10 }}>⌘C</kbd> = kopírovat</div>
              <div><kbd style={{ backgroundColor: '#374151', padding: '1px 4px', borderRadius: 3, marginRight: 4, fontSize: 10 }}>⌘X</kbd> = vyjmout</div>
              <div><kbd style={{ backgroundColor: '#374151', padding: '1px 4px', borderRadius: 3, marginRight: 4, fontSize: 10 }}>⌘V</kbd> = vložit (i z Figmy!)</div>
              <div><kbd style={{ backgroundColor: '#374151', padding: '1px 4px', borderRadius: 3, marginRight: 4, fontSize: 10 }}>⌘G</kbd> = seskupit</div>
              <div><kbd style={{ backgroundColor: '#374151', padding: '1px 4px', borderRadius: 3, marginRight: 4, fontSize: 10 }}>⇧⌘G</kbd> = uvolnit</div>
              <div><kbd style={{ backgroundColor: '#374151', padding: '1px 4px', borderRadius: 3, marginRight: 4, fontSize: 10 }}>⌘D</kbd> = duplikovat</div>
              <div><kbd style={{ backgroundColor: '#374151', padding: '1px 4px', borderRadius: 3, marginRight: 4, fontSize: 10 }}>Alt</kbd> + táhnutí = kopie</div>
            </div>
          </div>

          {/* Debug panel toggle */}
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '8px 12px',
              backgroundColor: showDebug ? '#7c3aed' : '#374151',
              border: 'none',
              borderRadius: 6,
              color: '#e5e7eb',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            🔧 Debug Clipboard {showDebug ? '(skrýt)' : '(zobrazit)'}
          </button>

          {showDebug && (
            <div style={{ marginTop: 8, padding: 12, backgroundColor: '#0f172a', borderRadius: 8, border: '1px solid #7c3aed' }}>
              <div style={{ fontSize: 10, color: '#a78bfa', marginBottom: 8, fontWeight: 600 }}>
                CLIPBOARD DEBUG
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                Vlož sem Ctrl+V z Figmy:
              </div>
              <div
                onPaste={(e) => {
                  e.preventDefault();
                  const items = e.clipboardData?.items;
                  if (!items) {
                    setDebugClipboard('❌ Žádná data ve schránce');
                    return;
                  }

                  const types: string[] = [];
                  for (const item of Array.from(items)) {
                    types.push(`${item.kind}: ${item.type}`);
                  }
                  
                  let result = `📋 Typy: ${types.join(', ')}\n\n`;
                  console.log('📋 Clipboard types:', types);

                  // Check for images
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                      const file = item.getAsFile();
                      if (file) {
                        result += `🖼️ Obrázek: ${file.type}, ${file.size} bytes\n`;
                        console.log('🖼️ Image found:', file.type, file.size);
                        
                        // Create image and show preview
                        const url = URL.createObjectURL(file);
                        setDebugClipboard(result + `\n✅ Obrázek načten! URL: ${url.substring(0, 50)}...`);
                        
                        // Auto-insert the image
                        const img = new Image();
                        img.src = url;
                        img.onload = () => {
                          const maxSize = 200;
                          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                          
                          const newObject: CanvasImage = {
                            id: `debug-img-${Date.now()}`,
                            type: 'image',
                            x: 50,
                            y: 50,
                            width: img.width * scale,
                            height: img.height * scale,
                            zIndex: Math.max(0, ...content.objects.map(o => o.zIndex)) + 1,
                            locked: false,
                            url,
                            objectFit: 'contain',
                          };
                          
                          onUpdate({ ...content, objects: [...content.objects, newObject] });
                          setSelectedObjectIds([newObject.id]);
                          setDebugClipboard(prev => prev + '\n\n✅ VLOŽENO NA PLÁTNO!');
                        };
                        return;
                      }
                    }
                  }

                  // Check for text
                  const text = e.clipboardData?.getData('text/plain');
                  if (text) {
                    result += `📝 Text: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}\n`;
                  }

                  // Check for HTML - Figma uses this format
                  const html = e.clipboardData?.getData('text/html');
                  if (html) {
                    result += `🌐 HTML detected\n`;
                    console.log('Full HTML:', html);
                    
                    // Try to extract Figma data
                    const figmaMatch = html.match(/<!--\(figma\)([^-]+)-->/);
                    const figmetaMatch = html.match(/<!--\(figmeta\)([^-]+)-->/);
                    
                    if (figmaMatch || figmetaMatch) {
                      result += `🎨 Figma data found!\n`;
                      
                      try {
                        // Decode figma data (it's base64)
                        if (figmaMatch) {
                          const decoded = atob(figmaMatch[1]);
                          console.log('Decoded figma:', decoded);
                          
                          // Check if it contains SVG
                          if (decoded.includes('<svg') || decoded.includes('svg')) {
                            result += `✅ Contains SVG data\n`;
                            
                            // Extract SVG from decoded data
                            const svgMatch = decoded.match(/<svg[^>]*>[\s\S]*<\/svg>/i);
                            if (svgMatch) {
                              setDebugClipboard(svgMatch[0]);
                              return;
                            }
                          }
                          
                          // Try to parse as JSON
                          try {
                            const jsonData = JSON.parse(decoded);
                            console.log('Figma JSON:', jsonData);
                            result += `📊 JSON data: ${JSON.stringify(jsonData).substring(0, 100)}...\n`;
                          } catch {
                            result += `📄 Raw data: ${decoded.substring(0, 100)}...\n`;
                          }
                        }
                      } catch (err) {
                        console.error('Decode error:', err);
                        result += `⚠️ Could not decode Figma data\n`;
                      }
                    }
                    
                    // Check if HTML itself contains SVG
                    const svgInHtml = html.match(/<svg[^>]*>[\s\S]*?<\/svg>/i);
                    if (svgInHtml) {
                      result += `✅ SVG found in HTML!\n`;
                      setDebugClipboard(svgInHtml[0]);
                      
                      // Auto-insert SVG
                      const newObjects = parseSvgToObjects(svgInHtml[0]);
                      if (newObjects.length > 0) {
                        onUpdate({ ...content, objects: [...content.objects, ...newObjects] });
                        setSelectedObjectIds(newObjects.map(o => o.id));
                        setDebugClipboard(result + '\n\n✅ SVG VLOŽENO NA PLÁTNO!');
                        return;
                      }
                    }
                  }

                  setDebugClipboard(result + '\n\n💡 Zkus ve Figmě: Pravý klik → Copy as → Copy as SVG');
                }}
                tabIndex={0}
                style={{
                  width: '100%',
                  minHeight: 100,
                  padding: 8,
                  backgroundColor: '#1e293b',
                  border: '2px dashed #7c3aed',
                  borderRadius: 4,
                  color: '#e5e7eb',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  outline: 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {debugClipboard || '👆 Klikni SEM a stiskni Ctrl+V\n\n(Obrázek se automaticky vloží na plátno)'}
              </div>
              
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>
                💡 Tip: Ve Figmě zkus pravý klik → "Copy as SVG"
              </div>
              
              {/* SVG input */}
              <textarea
                value={debugClipboard.includes('<svg') ? debugClipboard : ''}
                onChange={(e) => setDebugClipboard(e.target.value)}
                placeholder="Nebo sem vlož SVG kód ručně..."
                style={{
                  marginTop: 8,
                  width: '100%',
                  height: 60,
                  padding: 8,
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 4,
                  color: '#e5e7eb',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  resize: 'none',
                }}
              />
              
              <button
                onClick={() => {
                  if (debugClipboard.includes('<svg')) {
                    const newObjects = parseSvgToObjects(debugClipboard);
                    if (newObjects.length > 0) {
                      onUpdate({ ...content, objects: [...content.objects, ...newObjects] });
                      setSelectedObjectIds(newObjects.map(o => o.id));
                      setDebugClipboard('✅ SVG vloženo!');
                    }
                  }
                }}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: '6px',
                  backgroundColor: debugClipboard.includes('<svg') ? '#10b981' : '#475569',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  fontSize: 11,
                  cursor: debugClipboard.includes('<svg') ? 'pointer' : 'not-allowed',
                }}
                disabled={!debugClipboard.includes('<svg')}
              >
                Vložit SVG z textarey
              </button>
              
              <button
                onClick={() => setDebugClipboard('')}
                style={{
                  marginTop: 4,
                  width: '100%',
                  padding: '4px',
                  backgroundColor: 'transparent',
                  border: '1px solid #475569',
                  borderRadius: 4,
                  color: '#94a3b8',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
              >
                Vymazat
              </button>
            </div>
          )}

          {/* Selection Colors (when multiple objects selected) */}
          {selectedObjects.length > 1 && selectionColors.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #374151' }}>
              <label style={{ display: 'block', marginBottom: 10, fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em' }}>
                SELECTION COLORS
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectionColors.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={item.color}
                      onChange={(e) => changeSelectionColor(item.color, e.target.value, item.type)}
                      style={{ width: 28, height: 24, border: '2px solid #374151', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                    />
                    <input
                      type="text"
                      value={item.color.replace('#', '').toUpperCase()}
                      onChange={(e) => changeSelectionColor(item.color, '#' + e.target.value, item.type)}
                      style={{ width: 70, padding: '4px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <span style={{ fontSize: 10, color: '#6b7280' }}>100%</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: '#6b7280' }}>
                {selectedObjects.length} objektů vybráno
              </div>
            </div>
          )}

          {/* Selected Object Actions */}
          {selectedObjects.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #374151' }}>
              <label style={{ display: 'block', marginBottom: 10, fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em' }}>
                {selectedObjects.length > 1 ? `VYBRANÉ OBJEKTY (${selectedObjects.length})` : 'VYBRANÝ OBJEKT'}
              </label>
              
              {/* Position & Size - only for single selection */}
              {selectedObject && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: '#6b7280' }}>X</label>
                    <input
                      type="number"
                      value={Math.round(selectedObject.x)}
                      onChange={(e) => updateObject(selectedObject.id, { x: Number(e.target.value) })}
                      style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#6b7280' }}>Y</label>
                    <input
                      type="number"
                      value={Math.round(selectedObject.y)}
                      onChange={(e) => updateObject(selectedObject.id, { y: Number(e.target.value) })}
                      style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#6b7280' }}>Šířka</label>
                    <input
                      type="number"
                      value={Math.round(selectedObject.width)}
                      onChange={(e) => updateObject(selectedObject.id, { width: Math.max(10, Number(e.target.value)) })}
                      style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#6b7280' }}>Výška</label>
                    <input
                      type="number"
                      value={Math.round(selectedObject.height)}
                      onChange={(e) => updateObject(selectedObject.id, { height: Math.max(10, Number(e.target.value)) })}
                      style={{ width: '100%', padding: '6px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12 }}
                    />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={() => moveLayer('up')} style={actionBtnStyle} title="Posunout nahoru">
                  <ChevronUp size={18} />
                </button>
                <button onClick={() => moveLayer('down')} style={actionBtnStyle} title="Posunout dolů">
                  <ChevronDown size={18} />
                </button>
                <button onClick={duplicateSelected} style={actionBtnStyle} title="Duplikovat (Ctrl+D)">
                  <Copy size={18} />
                </button>
                <button onClick={toggleLock} style={{ ...actionBtnStyle, color: selectedObjects.some(o => o.locked) ? '#fbbf24' : '#9ca3af' }} title="Zamknout/Odemknout">
                  {selectedObjects.some(o => o.locked) ? <Lock size={18} /> : <Unlock size={18} />}
                </button>
                <button onClick={deleteSelected} style={{ ...actionBtnStyle, color: '#ef4444' }} title="Smazat (Delete)">
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Fill & Stroke for shapes (like Figma) - single selection only */}
              {selectedObject && (selectedObject.type === 'rectangle' || selectedObject.type === 'ellipse') && (
                <>
                  {/* Fill */}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #374151' }}>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em' }}>FILL</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={(selectedObject as CanvasRectangle | CanvasEllipse).fill || '#3B82F6'}
                        onChange={(e) => updateObject(selectedObject.id, { fill: e.target.value })}
                        style={{ width: 32, height: 28, border: '2px solid #374151', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                      />
                      <input
                        type="text"
                        value={((selectedObject as CanvasRectangle | CanvasEllipse).fill || '#3B82F6').replace('#', '').toUpperCase()}
                        onChange={(e) => updateObject(selectedObject.id, { fill: '#' + e.target.value })}
                        style={{ width: 80, padding: '6px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12, fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  {/* Stroke */}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #374151' }}>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em' }}>STROKE</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="color"
                        value={(selectedObject as CanvasRectangle | CanvasEllipse).stroke || '#000000'}
                        onChange={(e) => updateObject(selectedObject.id, { stroke: e.target.value })}
                        style={{ width: 32, height: 28, border: '2px solid #374151', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                      />
                      <input
                        type="text"
                        value={((selectedObject as CanvasRectangle | CanvasEllipse).stroke || '000000').replace('#', '').toUpperCase()}
                        onChange={(e) => updateObject(selectedObject.id, { stroke: '#' + e.target.value })}
                        style={{ width: 80, padding: '6px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12, fontFamily: 'monospace' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#6b7280', width: 50 }}>Šířka</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={(selectedObject as CanvasRectangle | CanvasEllipse).strokeWidth || 0}
                        onChange={(e) => updateObject(selectedObject.id, { strokeWidth: Number(e.target.value) })}
                        style={{ width: 60, padding: '6px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12 }}
                      />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>px</span>
                    </div>
                  </div>

                  {/* Border radius for rectangle */}
                  {selectedObject.type === 'rectangle' && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6b7280', flex: 1 }}>Zaoblení</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={(selectedObject as CanvasRectangle).borderRadius || 0}
                          onChange={(e) => updateObject(selectedObject.id, { borderRadius: Number(e.target.value) })}
                          style={{ width: 60, padding: '6px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12 }}
                        />
                        <span style={{ fontSize: 11, color: '#6b7280' }}>px</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Text settings - single selection only */}
              {selectedObject && selectedObject.type === 'text' && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: '#9ca3af' }}>Text</label>
                  <textarea
                    value={(selectedObject as CanvasText).text}
                    onChange={(e) => updateObject(selectedObject.id, { text: e.target.value })}
                    style={{
                      width: '100%',
                      minHeight: 60,
                      padding: 8,
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: 6,
                      color: '#e5e7eb',
                      fontSize: 13,
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={(selectedObject as CanvasText).fill || '#000000'}
                      onChange={(e) => updateObject(selectedObject.id, { fill: e.target.value })}
                      style={{ width: 32, height: 28, border: '2px solid #374151', borderRadius: 4, cursor: 'pointer' }}
                    />
                    <input
                      type="number"
                      value={(selectedObject as CanvasText).fontSize || 16}
                      onChange={(e) => updateObject(selectedObject.id, { fontSize: Math.max(8, Number(e.target.value)) })}
                      style={{ width: 60, padding: '4px 8px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#e5e7eb', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11, color: '#6b7280' }}>px</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Canvas Settings */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #374151' }}>
            <label style={{ display: 'block', marginBottom: 10, fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.05em' }}>
              NASTAVENÍ PLÁTNA
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Výška</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => onUpdate({ ...content, canvasHeight: Math.max(100, (content.canvasHeight || 400) - 50) })}
                  style={{ ...actionBtnStyle, width: 28, height: 28 }}
                >−</button>
                <span style={{ fontSize: 12, color: '#e5e7eb', minWidth: 50, textAlign: 'center' }}>{content.canvasHeight || 400}px</span>
                <button
                  onClick={() => onUpdate({ ...content, canvasHeight: Math.min(800, (content.canvasHeight || 400) + 50) })}
                  style={{ ...actionBtnStyle, width: 28, height: 28 }}
                >+</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Pozadí</span>
              <input
                type="color"
                value={content.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ ...content, backgroundColor: e.target.value })}
                style={{ width: 32, height: 28, border: '2px solid #374151', borderRadius: 4, cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Hotovo button at bottom */}
        <div style={{ padding: 16, borderTop: '1px solid #374151' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 24px',
              backgroundColor: '#3B82F6',
              border: 'none',
              borderRadius: 8,
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Check size={18} />
            Hotovo
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={canvasRef}
        onClick={(e) => {
          // Deselect only if clicking directly on the canvas area (not on objects)
          if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvasArea) {
            setSelectedObjectIds([]);
          }
          setContextMenu(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (selectedObjectIds.length > 0) {
            setContextMenu({ x: e.clientX, y: e.clientY });
          }
        }}
        onMouseDown={(e) => {
          // Start marquee selection when clicking on canvas area (including dark background)
          const target = e.target as HTMLElement;
          if (target === canvasRef.current || target.dataset.canvasArea || target.dataset.canvasWhite) {
            e.preventDefault();
            const rect = canvasRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setMarqueeStart({ x, y });
            setMarqueeEnd({ x, y });
            setIsMarqueeActive(true);
            if (!e.shiftKey) {
              setSelectedObjectIds([]);
            }
          }
        }}
        onMouseMove={(e) => {
          if (isMarqueeActive && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setMarqueeEnd({ x, y });
          }
        }}
        onMouseUp={() => {
          if (isMarqueeActive && marqueeStart && marqueeEnd) {
            // Calculate marquee bounds relative to white canvas
            const canvasOffsetX = (canvasRef.current!.offsetWidth - canvasWidth) / 2;
            const canvasOffsetY = (canvasRef.current!.offsetHeight - (content.canvasHeight || 400)) / 2;
            
            const minX = Math.min(marqueeStart.x, marqueeEnd.x) - canvasOffsetX;
            const maxX = Math.max(marqueeStart.x, marqueeEnd.x) - canvasOffsetX;
            const minY = Math.min(marqueeStart.y, marqueeEnd.y) - canvasOffsetY;
            const maxY = Math.max(marqueeStart.y, marqueeEnd.y) - canvasOffsetY;
            
            // Find objects within marquee (only if marquee has some size)
            if (Math.abs(marqueeEnd.x - marqueeStart.x) > 5 || Math.abs(marqueeEnd.y - marqueeStart.y) > 5) {
              const selectedIds = content.objects
                .filter(obj => {
                  const objRight = obj.x + obj.width;
                  const objBottom = obj.y + obj.height;
                  // Check if object intersects with marquee
                  return obj.x < maxX && objRight > minX && obj.y < maxY && objBottom > minY;
                })
                .map(obj => obj.id);
              
              setSelectedObjectIds(prev => 
                [...new Set([...prev, ...selectedIds])]
              );
            }
          }
          setIsMarqueeActive(false);
          setMarqueeStart(null);
          setMarqueeEnd(null);
        }}
        onMouseLeave={() => {
          // Don't cancel marquee on leave - let mouseup handle it
        }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          padding: 40,
          position: 'relative',
          cursor: isMarqueeActive ? 'crosshair' : 'default',
        }}
        data-canvas-area="true"
      >
        <div
          data-canvas-white="true"
          style={{
            width: canvasWidth,
            height: content.canvasHeight || 400,
            backgroundColor: content.backgroundColor || '#ffffff',
            position: 'relative',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            borderRadius: 4,
            backgroundImage: content.showGrid
              ? `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`
              : undefined,
            backgroundSize: content.showGrid ? `${content.gridSize || 20}px ${content.gridSize || 20}px` : undefined,
          }}
        >
          {/* Render objects with TransformableObject wrapper */}
          {[...content.objects]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(obj => (
              <TransformableObject
                key={obj.id}
                id={obj.id}
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                rotation={0}
                isSelected={selectedObjectIds.includes(obj.id)}
                isLocked={obj.locked}
                onSelect={() => {
                  // Shift+click = add to selection
                  const event = window.event as MouseEvent | undefined;
                  if (event?.shiftKey) {
                    setSelectedObjectIds(prev => 
                      prev.includes(obj.id) 
                        ? prev.filter(id => id !== obj.id) 
                        : [...prev, obj.id]
                    );
                  } else {
                    setSelectedObjectIds([obj.id]);
                  }
                }}
                onTransform={(state) => handleTransform(obj.id, state)}
                onDuplicate={() => duplicateObject(obj.id)}
                minWidth={20}
                minHeight={20}
              >
                {renderObjectContent(obj)}
              </TransformableObject>
            ))}

        </div>

        {/* Marquee selection rectangle - on main canvas area, not white canvas */}
        {isMarqueeActive && marqueeStart && marqueeEnd && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(marqueeStart.x, marqueeEnd.x),
              top: Math.min(marqueeStart.y, marqueeEnd.y),
              width: Math.abs(marqueeEnd.x - marqueeStart.x),
              height: Math.abs(marqueeEnd.y - marqueeStart.y),
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px dashed #3B82F6',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          />
        )}
      </div>

      {/* Drag & Drop Overlay */}
      {isDraggingOver && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            border: '4px dashed #3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              padding: '24px 48px',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>📁</div>
            <div style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 600 }}>
              Pusť soubor pro vložení
            </div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
              PNG, JPG, SVG...
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 8,
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            zIndex: 100000,
            minWidth: 180,
            padding: 4,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {canGroup && (
            <button
              onClick={() => { groupSelected(); setContextMenu(null); }}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: '#e5e7eb',
                fontSize: 13,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#374151'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
            >
              <span>Seskupit</span>
              <span style={{ color: '#6b7280', fontSize: 11 }}>⌘G</span>
            </button>
          )}
          {hasGroupSelected && selectedObjectIds.length === 1 && (
            <button
              onClick={() => { ungroupSelected(); setContextMenu(null); }}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: '#e5e7eb',
                fontSize: 13,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#374151'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
            >
              <span>Uvolnit skupinu</span>
              <span style={{ color: '#6b7280', fontSize: 11 }}>⇧⌘G</span>
            </button>
          )}
          <div style={{ height: 1, backgroundColor: '#374151', margin: '4px 0' }} />
          <button
            onClick={() => { copySelected(); setContextMenu(null); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: '#e5e7eb',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#374151'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
          >
            <span>Kopírovat</span>
            <span style={{ color: '#6b7280', fontSize: 11 }}>⌘C</span>
          </button>
          <button
            onClick={() => { cutSelected(); setContextMenu(null); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: '#e5e7eb',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#374151'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
          >
            <span>Vyjmout</span>
            <span style={{ color: '#6b7280', fontSize: 11 }}>⌘X</span>
          </button>
          <button
            onClick={() => { pasteInternal(); setContextMenu(null); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: '#e5e7eb',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#374151'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
          >
            <span>Vložit</span>
            <span style={{ color: '#6b7280', fontSize: 11 }}>⌘V</span>
          </button>
          <div style={{ height: 1, backgroundColor: '#374151', margin: '4px 0' }} />
          <button
            onClick={() => { duplicateSelected(); setContextMenu(null); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: '#e5e7eb',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#374151'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
          >
            <span>Duplikovat</span>
            <span style={{ color: '#6b7280', fontSize: 11 }}>⌘D</span>
          </button>
          <button
            onClick={() => { deleteSelected(); setContextMenu(null); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 4,
              color: '#ef4444',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#374151'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
          >
            <span>Smazat</span>
            <span style={{ color: '#6b7280', fontSize: 11 }}>Del</span>
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
