/**
 * InfiniteCanvas - Nekonečné plátno ve stylu Figma
 * 
 * Ovládání jako ve Figmě:
 * - Scroll = pan vertikálně
 * - Shift + Scroll = pan horizontálně
 * - Ctrl/Cmd + Scroll = zoom (směrem k kurzoru)
 * - Space + drag = pan mode
 * - Middle mouse button + drag = pan
 * - Trackpad: dva prsty = pan, pinch = zoom
 */

import React, { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { ZoomIn, ZoomOut, Maximize, Hand, MousePointer2 } from 'lucide-react';

interface InfiniteCanvasProps {
  children: ReactNode;
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  gridSize?: number;
  showControls?: boolean;
  showMinimap?: boolean;
  showGrid?: boolean;
  onCanvasStateChange?: (state: { x: number; y: number; zoom: number }) => void;
}

export function InfiniteCanvas({
  children,
  initialZoom = 0.8,
  minZoom = 0.4,
  maxZoom = 1.5,
  gridSize = 50,
  showControls = true,
  showMinimap = false,
  showGrid = false, // Grid disabled by default
  onCanvasStateChange,
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Canvas state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  
  // Drag state
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });
  
  // Center content on mount
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const centerX = container.clientWidth / 2;
      const centerY = 100; // Start near top
      setPosition({ x: centerX, y: centerY });
    }
  }, []);
  
  // Notify parent of state changes
  useEffect(() => {
    onCanvasStateChange?.({ ...position, zoom });
  }, [position, zoom, onCanvasStateChange]);
  
  // Handle wheel - Figma style (native event for non-passive listener)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (e: WheelEvent) => {
      // Always prevent default to stop browser zoom
      e.preventDefault();
      e.stopPropagation();
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Detect if it's a pinch gesture (trackpad)
      // ctrlKey is set when pinching on trackpad
      const isPinchGesture = e.ctrlKey && Math.abs(e.deltaY) < 50;
      
      // Ctrl/Cmd + Scroll OR pinch = ZOOM
      if (e.ctrlKey || e.metaKey || isPinchGesture) {
        // Zoom towards mouse position
        const zoomSensitivity = isPinchGesture ? 0.02 : 0.001;
        const delta = 1 - e.deltaY * zoomSensitivity;
        const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * delta));
        
        // Calculate new position to zoom towards mouse
        const zoomRatio = newZoom / zoom;
        const newX = mouseX - (mouseX - position.x) * zoomRatio;
        const newY = mouseY - (mouseY - position.y) * zoomRatio;
        
        setZoom(newZoom);
        setPosition({ x: newX, y: newY });
      } else {
        // Normal scroll = PAN
        // Shift + Scroll = horizontal pan
        const panSpeed = 1;
        
        if (e.shiftKey) {
          // Shift + scroll = horizontal pan
          setPosition(prev => ({
            x: prev.x - e.deltaY * panSpeed,
            y: prev.y - e.deltaX * panSpeed,
          }));
        } else {
          // Normal scroll = vertical pan (+ horizontal if deltaX exists from trackpad)
          setPosition(prev => ({
            x: prev.x - e.deltaX * panSpeed,
            y: prev.y - e.deltaY * panSpeed,
          }));
        }
      }
    };
    
    // Add non-passive event listener to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, position, minZoom, maxZoom]);
  
  // Handle pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button (1) or Space + left click (0)
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setIsPanning(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      positionStart.current = { ...position };
    }
  }, [isSpacePressed, position]);
  
  // Handle pan move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    setPosition({
      x: positionStart.current.x + dx,
      y: positionStart.current.y + dy,
    });
  }, [isPanning]);
  
  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for pan mode
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      
      // Zoom shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoom(z => Math.min(maxZoom, z * 1.25));
        }
        if (e.key === '-') {
          e.preventDefault();
          setZoom(z => Math.max(minZoom, z / 1.25));
        }
        if (e.key === '0') {
          e.preventDefault();
          setZoom(1);
        }
        if (e.key === '1') {
          e.preventDefault();
          handleZoomFit();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [minZoom, maxZoom]);
  
  // Zoom controls
  const handleZoomIn = () => {
    const container = containerRef.current;
    if (!container) return setZoom(z => Math.min(maxZoom, z * 1.25));
    
    // Zoom towards center
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    const newZoom = Math.min(maxZoom, zoom * 1.25);
    const zoomRatio = newZoom / zoom;
    
    setZoom(newZoom);
    setPosition(prev => ({
      x: centerX - (centerX - prev.x) * zoomRatio,
      y: centerY - (centerY - prev.y) * zoomRatio,
    }));
  };
  
  const handleZoomOut = () => {
    const container = containerRef.current;
    if (!container) return setZoom(z => Math.max(minZoom, z / 1.25));
    
    // Zoom towards center
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    const newZoom = Math.max(minZoom, zoom / 1.25);
    const zoomRatio = newZoom / zoom;
    
    setZoom(newZoom);
    setPosition(prev => ({
      x: centerX - (centerX - prev.x) * zoomRatio,
      y: centerY - (centerY - prev.y) * zoomRatio,
    }));
  };
  
  const handleZoomFit = useCallback(() => {
    setZoom(0.6);
    if (containerRef.current) {
      setPosition({
        x: containerRef.current.clientWidth / 2,
        y: 100,
      });
    }
  }, []);
  
  // Grid pattern (optional)
  const gridPattern = showGrid ? `
    <svg width="${gridSize}" height="${gridSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
          <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="rgba(148, 163, 184, 0.08)" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  ` : null;
  
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        backgroundColor: '#0F172A',
        backgroundImage: showGrid && gridPattern ? `url("data:image/svg+xml,${encodeURIComponent(gridPattern)}")` : 'none',
        backgroundPosition: showGrid ? `${position.x % gridSize}px ${position.y % gridSize}px` : undefined,
        cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Transformovaný obsah */}
      <div
        ref={contentRef}
        className="absolute origin-top-left"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
      
      {/* Zoom controls - inline styles for proper fill */}
      {showControls && (
        <div 
          className="flex items-center gap-2 rounded-xl p-2 shadow-xl"
          style={{ 
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'rgba(30, 41, 59, 0.95)', 
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(71, 85, 105, 0.5)',
            zIndex: 100,
          }}
        >
          <button
            onClick={handleZoomOut}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#334155',
              border: 'none',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Oddálit (Ctrl+-)"
          >
            <ZoomOut size={18} />
          </button>
          
          <div style={{ padding: '0 12px', minWidth: '60px', textAlign: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>
          
          <button
            onClick={handleZoomIn}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#334155',
              border: 'none',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Přiblížit (Ctrl++)"
          >
            <ZoomIn size={18} />
          </button>
          
          <div style={{ width: '1px', height: '24px', backgroundColor: '#475569', margin: '0 4px' }} />
          
          <button
            onClick={handleZoomFit}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: '#334155',
              border: 'none',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Přizpůsobit (Ctrl+1)"
          >
            <Maximize size={18} />
          </button>
          
          {isSpacePressed && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '4px 8px', 
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.4)',
              }}
            >
              <Hand size={14} style={{ color: '#60a5fa' }} />
              <span style={{ fontSize: '12px', color: '#60a5fa' }}>Pan</span>
            </div>
          )}
        </div>
      )}
      
    </div>
  );
}
