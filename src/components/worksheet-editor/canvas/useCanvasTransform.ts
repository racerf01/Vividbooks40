/**
 * useCanvasTransform - Profesionální transformační systém pro canvas objekty
 * 
 * Inspirováno Figma/Canva editorem s plnou podporou modifikátorů:
 * 
 * RESIZE (změna velikosti):
 * - Tažení za handle = volná transformace
 * - Shift = zachování poměru stran (aspect ratio lock)
 * - Alt = transformace od středu (resize from center)
 * - Shift + Alt = obojí kombinované
 * 
 * MOVE (přesun):
 * - Tažení = volný přesun
 * - Shift = omezení na osu (X nebo Y podle směru pohybu)
 * - Arrow keys = posun o 1px
 * - Shift + Arrow = posun o 10px
 * 
 * ROTATE (otáčení):
 * - Tažení za rotační handle = volné otáčení
 * - Shift = přichycení k 15° (0°, 15°, 30°, 45°, 60°, 75°, 90°...)
 * 
 * HANDLES:
 * - 4 rohové (nw, ne, sw, se) - diagonální resize
 * - 4 hranové (n, e, s, w) - jednosměrný resize
 * - 1 rotační (nad objektem)
 */

import { useCallback, useState, useRef, useEffect } from 'react';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

export interface TransformState {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // ve stupních
}

export interface TransformOptions {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  snapAngle?: number; // úhel pro přichycení při rotaci (default 15°)
  gridSize?: number; // pro snap to grid
  snapToGrid?: boolean;
}

interface ModifierKeys {
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
}

interface DragState {
  isActive: boolean;
  mode: 'move' | 'resize' | 'rotate' | null;
  handle: HandlePosition | null;
  startX: number;
  startY: number;
  startState: TransformState;
  axisLock: 'x' | 'y' | null; // pro Shift move
  aspectRatio: number; // width / height
}

const DEFAULT_OPTIONS: TransformOptions = {
  minWidth: 10,
  minHeight: 10,
  maxWidth: 2000,
  maxHeight: 2000,
  snapAngle: 15,
  gridSize: 10,
  snapToGrid: false,
};

/**
 * Hlavní hook pro transformace
 */
export function useCanvasTransform(
  initialState: TransformState,
  onUpdate: (state: TransformState) => void,
  options: TransformOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<TransformState>(initialState);
  const [modifiers, setModifiers] = useState<ModifierKeys>({ shift: false, alt: false, ctrl: false, meta: false });
  const dragStateRef = useRef<DragState>({
    isActive: false,
    mode: null,
    handle: null,
    startX: 0,
    startY: 0,
    startState: initialState,
    axisLock: null,
    aspectRatio: initialState.width / initialState.height,
  });

  // Synchronizace s external state
  useEffect(() => {
    setState(initialState);
    dragStateRef.current.aspectRatio = initialState.width / initialState.height;
  }, [initialState.x, initialState.y, initialState.width, initialState.height, initialState.rotation]);

  // Sledování modifier keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setModifiers({
        shift: e.shiftKey,
        alt: e.altKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
      });
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      setModifiers({
        shift: e.shiftKey,
        alt: e.altKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /**
   * Začátek přesunu objektu
   */
  const startMove = useCallback((clientX: number, clientY: number) => {
    dragStateRef.current = {
      isActive: true,
      mode: 'move',
      handle: null,
      startX: clientX,
      startY: clientY,
      startState: { ...state },
      axisLock: null,
      aspectRatio: state.width / state.height,
    };
  }, [state]);

  /**
   * Začátek resize
   */
  const startResize = useCallback((clientX: number, clientY: number, handle: HandlePosition) => {
    dragStateRef.current = {
      isActive: true,
      mode: 'resize',
      handle,
      startX: clientX,
      startY: clientY,
      startState: { ...state },
      axisLock: null,
      aspectRatio: state.width / state.height,
    };
  }, [state]);

  /**
   * Začátek rotace
   */
  const startRotate = useCallback((clientX: number, clientY: number) => {
    dragStateRef.current = {
      isActive: true,
      mode: 'rotate',
      handle: 'rotate',
      startX: clientX,
      startY: clientY,
      startState: { ...state },
      axisLock: null,
      aspectRatio: state.width / state.height,
    };
  }, [state]);

  /**
   * Zpracování pohybu myši během transformace
   */
  const handleMouseMove = useCallback((clientX: number, clientY: number, currentModifiers: ModifierKeys) => {
    const drag = dragStateRef.current;
    if (!drag.isActive || !drag.mode) return;

    const deltaX = clientX - drag.startX;
    const deltaY = clientY - drag.startY;

    let newState: TransformState;

    switch (drag.mode) {
      case 'move':
        newState = calculateMove(drag.startState, deltaX, deltaY, currentModifiers, drag, opts);
        break;
      case 'resize':
        newState = calculateResize(drag.startState, deltaX, deltaY, drag.handle!, currentModifiers, drag, opts);
        break;
      case 'rotate':
        newState = calculateRotation(drag.startState, clientX, clientY, currentModifiers, opts);
        break;
      default:
        return;
    }

    setState(newState);
    onUpdate(newState);
  }, [onUpdate, opts]);

  /**
   * Konec transformace
   */
  const endTransform = useCallback(() => {
    dragStateRef.current.isActive = false;
    dragStateRef.current.mode = null;
    dragStateRef.current.axisLock = null;
  }, []);

  /**
   * Posun pomocí arrow keys
   */
  const moveByArrows = useCallback((direction: 'up' | 'down' | 'left' | 'right', shiftKey: boolean) => {
    const step = shiftKey ? 10 : 1;
    let newState = { ...state };
    
    switch (direction) {
      case 'up':
        newState.y -= step;
        break;
      case 'down':
        newState.y += step;
        break;
      case 'left':
        newState.x -= step;
        break;
      case 'right':
        newState.x += step;
        break;
    }
    
    setState(newState);
    onUpdate(newState);
  }, [state, onUpdate]);

  return {
    state,
    modifiers,
    isTransforming: dragStateRef.current.isActive,
    transformMode: dragStateRef.current.mode,
    startMove,
    startResize,
    startRotate,
    handleMouseMove,
    endTransform,
    moveByArrows,
  };
}

/**
 * Výpočet nové pozice při přesunu
 */
function calculateMove(
  startState: TransformState,
  deltaX: number,
  deltaY: number,
  modifiers: ModifierKeys,
  dragState: DragState,
  opts: TransformOptions
): TransformState {
  let newX = startState.x + deltaX;
  let newY = startState.y + deltaY;

  // Shift = omezení na osu (určí se podle prvního výrazného pohybu)
  if (modifiers.shift) {
    // Určení osy podle většího pohybu (s hysterezí)
    const threshold = 5;
    if (!dragState.axisLock) {
      if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
        dragState.axisLock = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
      }
    }

    if (dragState.axisLock === 'x') {
      newY = startState.y;
    } else if (dragState.axisLock === 'y') {
      newX = startState.x;
    }
  } else {
    // Reset axis lock when shift is released
    dragState.axisLock = null;
  }

  // Snap to grid
  if (opts.snapToGrid && opts.gridSize) {
    newX = Math.round(newX / opts.gridSize) * opts.gridSize;
    newY = Math.round(newY / opts.gridSize) * opts.gridSize;
  }

  return { ...startState, x: newX, y: newY };
}

/**
 * Výpočet nových rozměrů při resize
 */
function calculateResize(
  startState: TransformState,
  deltaX: number,
  deltaY: number,
  handle: HandlePosition,
  modifiers: ModifierKeys,
  dragState: DragState,
  opts: TransformOptions
): TransformState {
  let { x, y, width, height, rotation } = startState;
  const aspectRatio = dragState.aspectRatio;

  // Určení, které strany se mění
  const affectsLeft = handle.includes('w');
  const affectsRight = handle.includes('e');
  const affectsTop = handle.includes('n');
  const affectsBottom = handle.includes('s');

  // Změna rozměrů
  let newWidth = width;
  let newHeight = height;
  let newX = x;
  let newY = y;

  if (affectsRight) {
    newWidth = width + deltaX;
  }
  if (affectsLeft) {
    newWidth = width - deltaX;
    newX = x + deltaX;
  }
  if (affectsBottom) {
    newHeight = height + deltaY;
  }
  if (affectsTop) {
    newHeight = height - deltaY;
    newY = y + deltaY;
  }

  // Shift = zachování poměru stran
  if (modifiers.shift) {
    const isCorner = ['nw', 'ne', 'sw', 'se'].includes(handle);
    const isHorizontal = ['e', 'w'].includes(handle);
    const isVertical = ['n', 's'].includes(handle);

    if (isCorner) {
      // Pro rohy: použijeme větší změnu jako základ
      const widthChange = Math.abs(newWidth - width);
      const heightChange = Math.abs(newHeight - height);
      
      if (widthChange > heightChange) {
        newHeight = newWidth / aspectRatio;
      } else {
        newWidth = newHeight * aspectRatio;
      }

      // Korekce pozice pro levý/horní handle
      if (affectsLeft) {
        newX = x + width - newWidth;
      }
      if (affectsTop) {
        newY = y + height - newHeight;
      }
    } else if (isHorizontal) {
      newHeight = newWidth / aspectRatio;
      // Centrovat vertikálně
      newY = y + (height - newHeight) / 2;
    } else if (isVertical) {
      newWidth = newHeight * aspectRatio;
      // Centrovat horizontálně
      newX = x + (width - newWidth) / 2;
    }
  }

  // Alt = transformace od středu
  if (modifiers.alt) {
    const centerX = startState.x + startState.width / 2;
    const centerY = startState.y + startState.height / 2;
    
    // Výpočet změny od středu
    const halfWidthChange = (newWidth - startState.width) / 2;
    const halfHeightChange = (newHeight - startState.height) / 2;
    
    newX = centerX - newWidth / 2;
    newY = centerY - newHeight / 2;
    
    // Pro Alt musíme zdvojnásobit efekt
    if (affectsRight && !affectsLeft) {
      newWidth = startState.width + deltaX * 2;
      newX = centerX - newWidth / 2;
    }
    if (affectsLeft && !affectsRight) {
      newWidth = startState.width - deltaX * 2;
      newX = centerX - newWidth / 2;
    }
    if (affectsBottom && !affectsTop) {
      newHeight = startState.height + deltaY * 2;
      newY = centerY - newHeight / 2;
    }
    if (affectsTop && !affectsBottom) {
      newHeight = startState.height - deltaY * 2;
      newY = centerY - newHeight / 2;
    }

    // Pokud je i Shift, znovu aplikujeme aspect ratio
    if (modifiers.shift) {
      const widthChange = Math.abs(newWidth - startState.width);
      const heightChange = Math.abs(newHeight - startState.height);
      
      if (widthChange > heightChange) {
        newHeight = newWidth / aspectRatio;
      } else {
        newWidth = newHeight * aspectRatio;
      }
      newX = centerX - newWidth / 2;
      newY = centerY - newHeight / 2;
    }
  }

  // Minimální rozměry
  if (newWidth < opts.minWidth!) {
    if (affectsLeft) {
      newX = x + width - opts.minWidth!;
    }
    newWidth = opts.minWidth!;
  }
  if (newHeight < opts.minHeight!) {
    if (affectsTop) {
      newY = y + height - opts.minHeight!;
    }
    newHeight = opts.minHeight!;
  }

  // Maximální rozměry
  if (opts.maxWidth && newWidth > opts.maxWidth) {
    newWidth = opts.maxWidth;
  }
  if (opts.maxHeight && newHeight > opts.maxHeight) {
    newHeight = opts.maxHeight;
  }

  return { x: newX, y: newY, width: newWidth, height: newHeight, rotation };
}

/**
 * Výpočet rotace
 */
function calculateRotation(
  startState: TransformState,
  clientX: number,
  clientY: number,
  modifiers: ModifierKeys,
  opts: TransformOptions
): TransformState {
  // Střed objektu
  const centerX = startState.x + startState.width / 2;
  const centerY = startState.y + startState.height / 2;

  // Úhel od středu k pozici myši
  const angle = Math.atan2(clientY - centerY, clientX - centerX);
  let degrees = angle * (180 / Math.PI) + 90; // +90 protože 0° je nahoře

  // Normalizace na 0-360
  while (degrees < 0) degrees += 360;
  while (degrees >= 360) degrees -= 360;

  // Shift = přichycení k úhlům
  if (modifiers.shift && opts.snapAngle) {
    degrees = Math.round(degrees / opts.snapAngle) * opts.snapAngle;
  }

  return { ...startState, rotation: degrees };
}

/**
 * Získání správného kurzoru pro handle
 */
export function getCursorForHandle(handle: HandlePosition, rotation: number = 0): string {
  const cursors: Record<HandlePosition, string> = {
    'nw': 'nwse-resize',
    'n': 'ns-resize',
    'ne': 'nesw-resize',
    'e': 'ew-resize',
    'se': 'nwse-resize',
    's': 'ns-resize',
    'sw': 'nesw-resize',
    'w': 'ew-resize',
    'rotate': 'grab',
  };

  // Pro rotaci bychom mohli rotovat i kurzory, ale je to komplikované
  // Ponecháváme základní kurzory
  return cursors[handle] || 'default';
}

/**
 * Pozice handles kolem objektu
 */
export function getHandlePositions(state: TransformState) {
  const { x, y, width, height } = state;
  const handleSize = 8;
  const offset = handleSize / 2;
  const rotateOffset = 24; // vzdálenost rotačního handle od objektu

  return {
    nw: { x: x - offset, y: y - offset },
    n: { x: x + width / 2 - offset, y: y - offset },
    ne: { x: x + width - offset, y: y - offset },
    e: { x: x + width - offset, y: y + height / 2 - offset },
    se: { x: x + width - offset, y: y + height - offset },
    s: { x: x + width / 2 - offset, y: y + height - offset },
    sw: { x: x - offset, y: y + height - offset },
    w: { x: x - offset, y: y + height / 2 - offset },
    rotate: { x: x + width / 2 - offset, y: y - rotateOffset - offset },
  };
}

/**
 * Kontrola, jestli je bod uvnitř handle
 */
export function isPointInHandle(
  pointX: number,
  pointY: number,
  handleX: number,
  handleY: number,
  handleSize: number = 12
): boolean {
  return (
    pointX >= handleX - handleSize / 2 &&
    pointX <= handleX + handleSize / 2 &&
    pointY >= handleY - handleSize / 2 &&
    pointY <= handleY + handleSize / 2
  );
}
