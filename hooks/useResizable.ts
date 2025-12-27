
import React, { useState, useCallback, useEffect, useRef } from 'react';

export const useResizable = ({
  initialSize = 350,
  minSize = 200,
  maxSize = 800,
  direction = 'horizontal' // 'horizontal' implies resizing width (columns)
}: {
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  direction?: 'horizontal' | 'vertical';
} = {}) => {
  const [size, setSize] = useState(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSizeRef.current = size;
    
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [size, direction]);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = currentPos - startPosRef.current;
    const newSize = Math.max(minSize, Math.min(maxSize, startSizeRef.current + delta));
    
    setSize(newSize);
  }, [minSize, maxSize, direction]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return { size, isResizing, startResizing };
};
