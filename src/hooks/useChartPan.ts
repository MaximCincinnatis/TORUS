import { useState, useCallback, useEffect } from 'react';

interface UseChartPanOptions {
  totalDataPoints: number;
  windowSize: number;
  initialIndex?: number;
}

interface UseChartPanReturn {
  startIndex: number;
  endIndex: number;
  visibleRange: [number, number];
  canPanLeft: boolean;
  canPanRight: boolean;
  panLeft: () => void;
  panRight: () => void;
  panTo: (index: number) => void;
  reset: () => void;
  handleWheel: (e: WheelEvent) => void;
}

export function useChartPan({
  totalDataPoints,
  windowSize,
  initialIndex = 0
}: UseChartPanOptions): UseChartPanReturn {
  const [startIndex, setStartIndex] = useState(initialIndex);
  
  // Calculate bounds
  const maxStartIndex = Math.max(0, totalDataPoints - windowSize);
  const endIndex = Math.min(startIndex + windowSize, totalDataPoints);
  
  // Pan functions
  const panLeft = useCallback(() => {
    setStartIndex(prev => Math.max(0, prev - Math.floor(windowSize / 2)));
  }, [windowSize]);
  
  const panRight = useCallback(() => {
    setStartIndex(prev => Math.min(maxStartIndex, prev + Math.floor(windowSize / 2)));
  }, [maxStartIndex, windowSize]);
  
  const panTo = useCallback((index: number) => {
    setStartIndex(Math.max(0, Math.min(maxStartIndex, index)));
  }, [maxStartIndex]);
  
  const reset = useCallback(() => {
    setStartIndex(0);
  }, []);
  
  // Mouse wheel handler
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      panRight();
    } else {
      panLeft();
    }
  }, [panLeft, panRight]);
  
  return {
    startIndex,
    endIndex,
    visibleRange: [startIndex, endIndex],
    canPanLeft: startIndex > 0,
    canPanRight: startIndex < maxStartIndex,
    panLeft,
    panRight,
    panTo,
    reset,
    handleWheel
  };
}