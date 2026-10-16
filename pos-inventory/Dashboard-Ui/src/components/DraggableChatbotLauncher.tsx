import React, { useState, useEffect, useRef, useCallback } from 'react';
import chatbotLogo from '../assets/Chatbot.png';

interface DraggableChatbotLauncherProps {
  onOpen: () => void;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'atlas_chatbot_launcher_pos';
// Aspect ratio of the cropped robot + pill logo is 876x610 (1.436 : 1)
const LAUNCHER_WIDTH = 148;  // px
const LAUNCHER_HEIGHT = 103; // px
const EDGE_MARGIN = 16;      // px
const DRAG_THRESHOLD = 5;    // px

export const DraggableChatbotLauncher: React.FC<DraggableChatbotLauncherProps> = ({ onOpen }) => {
  // Clamps coordinates within the visible viewport with safety margin
  const clampPosition = useCallback((x: number, y: number): Position => {
    if (typeof window === 'undefined') return { x, y };
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - LAUNCHER_WIDTH - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - LAUNCHER_HEIGHT - EDGE_MARGIN);
    return {
      x: Math.min(Math.max(EDGE_MARGIN, x), maxX),
      y: Math.min(Math.max(EDGE_MARGIN, y), maxY),
    };
  }, []);

  // Initial position from sessionStorage or default bottom-right
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            const maxX = Math.max(EDGE_MARGIN, window.innerWidth - LAUNCHER_WIDTH - EDGE_MARGIN);
            const maxY = Math.max(EDGE_MARGIN, window.innerHeight - LAUNCHER_HEIGHT - EDGE_MARGIN);
            return {
              x: Math.min(Math.max(EDGE_MARGIN, parsed.x), maxX),
              y: Math.min(Math.max(EDGE_MARGIN, parsed.y), maxY),
            };
          }
        }
      } catch (err) {
        console.warn('Failed to parse saved chatbot launcher position:', err);
      }
      return {
        x: Math.max(EDGE_MARGIN, window.innerWidth - LAUNCHER_WIDTH - 24),
        y: Math.max(EDGE_MARGIN, window.innerHeight - LAUNCHER_HEIGHT - 24),
      };
    }
    return { x: 0, y: 0 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef<Position>(position);
  positionRef.current = position;

  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    posX: number;
    posY: number;
  } | null>(null);

  const hasMovedRef = useRef(false);

  // Re-clamp on window resize so launcher is never lost off-screen
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const clamped = clampPosition(prev.x, prev.y);
        positionRef.current = clamped;
        return clamped;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Pointer event handlers supporting mouse, touch, and stylus
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary button
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: positionRef.current.x,
      posY: positionRef.current.y,
    };
    hasMovedRef.current = false;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback if setPointerCapture is not supported
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    const distance = Math.hypot(dx, dy);

    if (!hasMovedRef.current && distance >= DRAG_THRESHOLD) {
      hasMovedRef.current = true;
      setIsDragging(true);
      document.body.style.userSelect = 'none';
    }

    if (hasMovedRef.current) {
      const rawX = dragStartRef.current.posX + dx;
      const rawY = dragStartRef.current.posY + dy;
      const clamped = clampPosition(rawX, rawY);
      positionRef.current = clamped;
      setPosition(clamped);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    document.body.style.userSelect = '';
    const wasMoved = hasMovedRef.current;

    dragStartRef.current = null;
    hasMovedRef.current = false;
    setIsDragging(false);

    if (wasMoved) {
      // Persist latest clamped position
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positionRef.current));
      } catch (err) {
        console.warn('Failed to save chatbot launcher position:', err);
      }
    } else {
      // Normal click detected! Open assistant
      onOpen();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    endDrag(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    endDrag(e);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <button
      type="button"
      role="button"
      tabIndex={0}
      aria-label="Open ATLAS AI Assistant"
      title="Open ATLAS AI Assistant (Drag to move)"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      onDragStart={(e) => e.preventDefault()}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${LAUNCHER_WIDTH}px`,
        height: `${LAUNCHER_HEIGHT}px`,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      className={`fixed z-50 p-0 bg-transparent border-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-2xl select-none group transition-transform duration-150 ${
        isDragging
          ? 'cursor-grabbing scale-105'
          : 'cursor-grab hover:scale-105 active:scale-95'
      }`}
    >
      <img
        src={chatbotLogo}
        alt="Open ATLAS AI Assistant"
        className="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_8px_20px_rgba(30,27,75,0.28)] group-hover:drop-shadow-[0_12px_28px_rgba(99,102,241,0.5)] transition-all duration-200"
        style={{ objectFit: 'contain' }}
        draggable={false}
      />
    </button>
  );
};
