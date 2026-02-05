/**
 * TransformableObject - Wrapper komponenta pro transformovatelné objekty
 * 
 * Zobrazuje selection handles a zpracovává všechny transformace:
 * - Move (přetahování)
 * - Resize (změna velikosti)
 * - Rotate (otáčení)
 * 
 * Podporuje všechny Figma-like modifikátory (Shift, Alt)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  HandlePosition, 
  TransformState, 
  getCursorForHandle,
  getHandlePositions,
} from './useCanvasTransform';

interface TransformableObjectProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  isSelected: boolean;
  isLocked?: boolean;
  children: React.ReactNode;
  onSelect: () => void;
  onTransform: (state: TransformState) => void;
  onDuplicate?: () => void; // Alt + drag creates a duplicate
  minWidth?: number;
  minHeight?: number;
}

const HANDLE_SIZE = 10;
const ROTATE_HANDLE_OFFSET = 28;

// Size tooltip component (like Figma)
function SizeTooltip({ width, height, x, y, objectHeight }: { width: number; height: number; x: number; y: number; objectHeight: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x + width / 2,
        top: y + objectHeight + 8,
        transform: 'translateX(-50%)',
        backgroundColor: '#3B82F6',
        color: 'white',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 1001,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {width.toFixed(0)} × {height.toFixed(0)}
    </div>
  );
}

export function TransformableObject({
  id,
  x,
  y,
  width,
  height,
  rotation = 0,
  isSelected,
  isLocked = false,
  children,
  onSelect,
  onTransform,
  onDuplicate,
  minWidth = 20,
  minHeight = 20,
}: TransformableObjectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandlePosition | 'move' | null>(null);
  const [axisLock, setAxisLock] = useState<'x' | 'y' | null>(null);
  const [hasDuplicated, setHasDuplicated] = useState(false);
  const [showSizeTooltip, setShowSizeTooltip] = useState(false);
  
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startRotation: number;
    aspectRatio: number;
  } | null>(null);

  // Handle mouse down na objekt (move)
  const handleObjectMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    onSelect();
    
    setIsDragging(true);
    setActiveHandle('move');
    setAxisLock(null);
    setHasDuplicated(false); // Reset duplicate flag
    
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: x,
      startY: y,
      startWidth: width,
      startHeight: height,
      startRotation: rotation,
      aspectRatio: width / height,
    };
  }, [isLocked, onSelect, x, y, width, height, rotation]);

  // Handle click (just select, don't deselect)
  const handleObjectClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Handle mouse down na resize handle
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: HandlePosition) => {
    if (isLocked) return;
    e.stopPropagation();
    
    setIsDragging(true);
    setActiveHandle(handle);
    setShowSizeTooltip(handle !== 'rotate'); // Show size tooltip for resize handles
    
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: x,
      startY: y,
      startWidth: width,
      startHeight: height,
      startRotation: rotation,
      aspectRatio: width / height,
    };
  }, [isLocked, x, y, width, height, rotation]);

  // Global mouse move handler
  useEffect(() => {
    if (!isDragging || !dragStartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const start = dragStartRef.current!;
      const deltaX = e.clientX - start.mouseX;
      const deltaY = e.clientY - start.mouseY;

      if (activeHandle === 'move') {
        // Alt + drag = duplicate (only once per drag)
        // Works with Shift too (Alt+Shift = duplicate + axis lock)
        if (e.altKey && !hasDuplicated && onDuplicate) {
          const moveThreshold = 5;
          if (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold) {
            setHasDuplicated(true);
            onDuplicate();
            return;
          }
        }

        // MOVE
        let newX = start.startX + deltaX;
        let newY = start.startY + deltaY;

        // Shift = axis lock (works alone or with Alt for duplicate+axis lock)
        if (e.shiftKey) {
          const threshold = 5;
          if (!axisLock && (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold)) {
            setAxisLock(Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y');
          }
          
          if (axisLock === 'x') {
            newY = start.startY;
          } else if (axisLock === 'y') {
            newX = start.startX;
          }
        } else {
          setAxisLock(null);
        }

        onTransform({ x: newX, y: newY, width, height, rotation });
      } else if (activeHandle === 'rotate') {
        // ROTATE
        const centerX = start.startX + start.startWidth / 2;
        const centerY = start.startY + start.startHeight / 2;
        
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        let degrees = angle * (180 / Math.PI) + 90;
        
        while (degrees < 0) degrees += 360;
        while (degrees >= 360) degrees -= 360;

        // Shift = snap to 15°
        if (e.shiftKey) {
          degrees = Math.round(degrees / 15) * 15;
        }

        onTransform({ x, y, width, height, rotation: degrees });
      } else if (activeHandle) {
        // RESIZE
        let newX = start.startX;
        let newY = start.startY;
        let newWidth = start.startWidth;
        let newHeight = start.startHeight;

        const handle = activeHandle as HandlePosition;
        const affectsLeft = handle.includes('w');
        const affectsRight = handle.includes('e');
        const affectsTop = handle.includes('n');
        const affectsBottom = handle.includes('s');

        if (affectsRight) newWidth = start.startWidth + deltaX;
        if (affectsLeft) {
          newWidth = start.startWidth - deltaX;
          newX = start.startX + deltaX;
        }
        if (affectsBottom) newHeight = start.startHeight + deltaY;
        if (affectsTop) {
          newHeight = start.startHeight - deltaY;
          newY = start.startY + deltaY;
        }

        // Shift = aspect ratio lock
        if (e.shiftKey) {
          const isCorner = ['nw', 'ne', 'sw', 'se'].includes(handle);
          
          if (isCorner) {
            const widthChange = Math.abs(newWidth - start.startWidth);
            const heightChange = Math.abs(newHeight - start.startHeight);
            
            if (widthChange > heightChange) {
              newHeight = newWidth / start.aspectRatio;
            } else {
              newWidth = newHeight * start.aspectRatio;
            }

            if (affectsLeft) newX = start.startX + start.startWidth - newWidth;
            if (affectsTop) newY = start.startY + start.startHeight - newHeight;
          }
        }

        // Alt = resize from center
        if (e.altKey) {
          const centerX = start.startX + start.startWidth / 2;
          const centerY = start.startY + start.startHeight / 2;
          
          if (affectsRight && !affectsLeft) {
            newWidth = start.startWidth + deltaX * 2;
          }
          if (affectsLeft && !affectsRight) {
            newWidth = start.startWidth - deltaX * 2;
          }
          if (affectsBottom && !affectsTop) {
            newHeight = start.startHeight + deltaY * 2;
          }
          if (affectsTop && !affectsBottom) {
            newHeight = start.startHeight - deltaY * 2;
          }

          // Re-apply aspect ratio if shift
          if (e.shiftKey) {
            const widthChange = Math.abs(newWidth - start.startWidth);
            const heightChange = Math.abs(newHeight - start.startHeight);
            
            if (widthChange > heightChange) {
              newHeight = newWidth / start.aspectRatio;
            } else {
              newWidth = newHeight * start.aspectRatio;
            }
          }

          newX = centerX - newWidth / 2;
          newY = centerY - newHeight / 2;
        }

        // Enforce minimums
        if (newWidth < minWidth) {
          if (affectsLeft) newX = start.startX + start.startWidth - minWidth;
          newWidth = minWidth;
        }
        if (newHeight < minHeight) {
          if (affectsTop) newY = start.startY + start.startHeight - minHeight;
          newHeight = minHeight;
        }

        onTransform({ x: newX, y: newY, width: newWidth, height: newHeight, rotation });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setActiveHandle(null);
      setAxisLock(null);
      setShowSizeTooltip(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, activeHandle, axisLock, x, y, width, height, rotation, onTransform, minWidth, minHeight]);

  // Arrow key navigation
  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      let newX = x;
      let newY = y;

      switch (e.key) {
        case 'ArrowUp': newY -= step; break;
        case 'ArrowDown': newY += step; break;
        case 'ArrowLeft': newX -= step; break;
        case 'ArrowRight': newX += step; break;
      }

      onTransform({ x: newX, y: newY, width, height, rotation });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isLocked, x, y, width, height, rotation, onTransform]);

  const handlePositions = getHandlePositions({ x, y, width, height, rotation });

  // Render handle
  const renderHandle = (position: HandlePosition, handleX: number, handleY: number) => {
    const isRotate = position === 'rotate';
    
    return (
      <div
        key={position}
        onMouseDown={(e) => handleResizeMouseDown(e, position)}
        style={{
          position: 'absolute',
          left: handleX,
          top: handleY,
          width: isRotate ? 12 : HANDLE_SIZE,
          height: isRotate ? 12 : HANDLE_SIZE,
          backgroundColor: isRotate ? '#10B981' : '#ffffff',
          border: `2px solid ${isRotate ? '#059669' : '#3B82F6'}`,
          borderRadius: isRotate ? '50%' : (['n', 's', 'e', 'w'].includes(position) ? 2 : 0),
          cursor: getCursorForHandle(position, rotation),
          zIndex: 1000,
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'transform 0.1s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.transform = 'translate(-50%, -50%) scale(1.2)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.transform = 'translate(-50%, -50%)';
        }}
      />
    );
  };

  return (
    <>
      {/* Main object container */}
      <div
        ref={containerRef}
        onMouseDown={handleObjectMouseDown}
        onClick={handleObjectClick}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: width,
          height: height,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center center',
          cursor: isLocked ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
          outline: isSelected ? '2px solid #3B82F6' : 'none',
          outlineOffset: 1,
          userSelect: 'none',
        }}
      >
        {children}
      </div>

      {/* Selection handles */}
      {isSelected && !isLocked && (
        <>
          {/* Rotation handle line */}
          <div
            style={{
              position: 'absolute',
              left: x + width / 2,
              top: y - ROTATE_HANDLE_OFFSET + HANDLE_SIZE,
              width: 1,
              height: ROTATE_HANDLE_OFFSET - HANDLE_SIZE,
              backgroundColor: '#3B82F6',
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
              transformOrigin: `0 ${ROTATE_HANDLE_OFFSET - HANDLE_SIZE + height / 2}px`,
              pointerEvents: 'none',
            }}
          />

          {/* Corner handles */}
          {renderHandle('nw', x, y)}
          {renderHandle('ne', x + width, y)}
          {renderHandle('se', x + width, y + height)}
          {renderHandle('sw', x, y + height)}

          {/* Edge handles */}
          {renderHandle('n', x + width / 2, y)}
          {renderHandle('e', x + width, y + height / 2)}
          {renderHandle('s', x + width / 2, y + height)}
          {renderHandle('w', x, y + height / 2)}

          {/* Rotation handle */}
          {renderHandle('rotate', x + width / 2, y - ROTATE_HANDLE_OFFSET)}

          {/* Size tooltip (shown during resize) */}
          {showSizeTooltip && (
            <SizeTooltip width={width} height={height} x={x} y={y} objectHeight={height} />
          )}
        </>
      )}
    </>
  );
}
