'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface RevolverPickerProps {
  items: number[];
  value: number;
  onChange: (value: number) => void;
  formatLabel?: (value: number) => string;
  className?: string;
  itemHeight?: number;
  visibleItems?: number;
}

export default function RevolverPicker({
  items,
  value,
  onChange,
  formatLabel = (v) => v.toString(),
  className = '',
  itemHeight = 40,
  visibleItems = 3, // 위아래 1개씩만 보이도록 (중앙 1개 + 위 1개 + 아래 1개)
}: RevolverPickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedIndexRef = useRef<number>(items.indexOf(value));
  const animationFrameRef = useRef<number | null>(null);
  const momentumRef = useRef<number>(0);

  // 선택된 값이 변경되면 스크롤 위치 업데이트
  useEffect(() => {
    const index = items.indexOf(value);
    if (index !== -1 && scrollContainerRef.current && !isDragging) {
      selectedIndexRef.current = index;
      const targetScroll = index * itemHeight;
      scrollContainerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
    }
  }, [value, items, itemHeight, isDragging]);

  // 스크롤 위치에 따라 가장 가까운 항목 선택 (부드러운 스냅)
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isDragging) return;
    
    const scrollTop = scrollContainerRef.current.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    
    if (clampedIndex !== selectedIndexRef.current) {
      selectedIndexRef.current = clampedIndex;
      onChange(items[clampedIndex]);
    }
  }, [items, itemHeight, onChange, isDragging]);

  // 모멘텀 스크롤 애니메이션
  const animateMomentum = useCallback(() => {
    if (!scrollContainerRef.current || !isDragging) {
      if (scrollContainerRef.current && Math.abs(momentumRef.current) > 0.1) {
        const currentScroll = scrollContainerRef.current.scrollTop;
        const newScroll = currentScroll + momentumRef.current;
        scrollContainerRef.current.scrollTop = newScroll;
        
        momentumRef.current *= 0.92; // 감쇠
        
        animationFrameRef.current = requestAnimationFrame(animateMomentum);
      } else {
        // 모멘텀 종료 시 스냅
        if (scrollContainerRef.current) {
          const scrollTop = scrollContainerRef.current.scrollTop;
          const index = Math.round(scrollTop / itemHeight);
          const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
          const targetScroll = clampedIndex * itemHeight;
          
          scrollContainerRef.current.scrollTo({
            top: targetScroll,
            behavior: 'smooth',
          });
          
          selectedIndexRef.current = clampedIndex;
          onChange(items[clampedIndex]);
        }
        momentumRef.current = 0;
      }
    }
  }, [isDragging, items, itemHeight, onChange]);

  // 키보드 네비게이션 (향후 사용 예정 - 현재 미사용)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIndex = items.indexOf(value);
    let newIndex = currentIndex;
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newIndex = Math.max(0, currentIndex - 1);
        onChange(items[newIndex]);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newIndex = Math.min(items.length - 1, currentIndex + 1);
        onChange(items[newIndex]);
        break;
      case 'Home':
        e.preventDefault();
        onChange(items[0]);
        break;
      case 'End':
        e.preventDefault();
        onChange(items[items.length - 1]);
        break;
      case 'PageUp':
        e.preventDefault();
        newIndex = Math.max(0, currentIndex - 5);
        onChange(items[newIndex]);
        break;
      case 'PageDown':
        e.preventDefault();
        newIndex = Math.min(items.length - 1, currentIndex + 5);
        onChange(items[newIndex]);
        break;
    }
  }, [items, value, onChange]);

  // 드래그 시작
  const handleMouseDown = (e: React.MouseEvent) => {
    // 텍스트 선택 방지
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setStartY(e.clientY);
    setLastY(e.clientY);
    setLastTime(Date.now());
    setVelocity(0);
    momentumRef.current = 0;
    
    if (scrollContainerRef.current) {
      setScrollOffset(scrollContainerRef.current.scrollTop);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // 드래그 중 (부드러운 움직임)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    
    // 텍스트 선택 방지
    e.preventDefault();
    
    const now = Date.now();
    const deltaTime = now - lastTime;
    const deltaY = e.clientY - lastY;
    
    if (deltaTime > 0) {
      const newVelocity = (deltaY / deltaTime) * 16; // 프레임당 속도
      setVelocity(newVelocity);
      momentumRef.current = newVelocity;
    }
    
    const totalDeltaY = e.clientY - startY;
    const newScroll = scrollOffset - totalDeltaY;
    scrollContainerRef.current.scrollTop = newScroll;
    
    setLastY(e.clientY);
    setLastTime(now);
    handleScroll();
  }, [isDragging, startY, scrollOffset, lastY, lastTime, handleScroll]);

  // 드래그 종료 (모멘텀 적용)
  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // 모멘텀 스크롤 시작
    if (Math.abs(momentumRef.current) > 0.5) {
      animationFrameRef.current = requestAnimationFrame(animateMomentum);
    } else {
      // 모멘텀 없으면 즉시 스냅
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        const index = Math.round(scrollTop / itemHeight);
        const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
        const targetScroll = clampedIndex * itemHeight;
        
        scrollContainerRef.current.scrollTo({
          top: targetScroll,
          behavior: 'smooth',
        });
        
        selectedIndexRef.current = clampedIndex;
        onChange(items[clampedIndex]);
      }
    }
  }, [isDragging, items, itemHeight, onChange, animateMomentum]);

  // 터치 이벤트
  const handleTouchStart = (e: React.TouchEvent) => {
    // 텍스트 선택 방지
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    const touch = e.touches[0];
    setStartY(touch.clientY);
    setLastY(touch.clientY);
    setLastTime(Date.now());
    setVelocity(0);
    momentumRef.current = 0;
    
    if (scrollContainerRef.current) {
      setScrollOffset(scrollContainerRef.current.scrollTop);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const now = Date.now();
    const deltaTime = now - lastTime;
    const deltaY = touch.clientY - lastY;
    
    if (deltaTime > 0) {
      const newVelocity = (deltaY / deltaTime) * 16;
      setVelocity(newVelocity);
      momentumRef.current = newVelocity;
    }
    
    const totalDeltaY = touch.clientY - startY;
    const newScroll = scrollOffset - totalDeltaY;
    scrollContainerRef.current.scrollTop = newScroll;
    
    setLastY(touch.clientY);
    setLastTime(now);
    handleScroll();
  }, [isDragging, startY, scrollOffset, lastY, lastTime, handleScroll]);

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // 컴포넌트 언마운트 시 애니메이션 정리
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const centerIndex = Math.floor(visibleItems / 2);
  const containerHeight = itemHeight * visibleItems;

  return (
    <div className={`relative ${className}`} style={{ height: containerHeight }}>
      {/* 그라데이션 오버레이 (위) - 더 부드러운 페이드 */}
      <div 
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
        style={{
          height: itemHeight * centerIndex,
          background: 'linear-gradient(to bottom, rgb(249, 250, 251) 0%, rgba(249, 250, 251, 0.8) 40%, rgba(249, 250, 251, 0) 100%)',
        }}
      />
      
      {/* 선택 영역 하이라이트 - 더 세련된 디자인 */}
      <div
        className="absolute left-0 right-0 z-0 pointer-events-none"
        style={{
          top: itemHeight * centerIndex,
          height: itemHeight,
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.04) 50%, rgba(0, 0, 0, 0.02) 100%)',
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        }}
      />
      
      {/* 그라데이션 오버레이 (아래) - 더 부드러운 페이드 */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
        style={{
          height: itemHeight * centerIndex,
          background: 'linear-gradient(to top, rgb(249, 250, 251) 0%, rgba(249, 250, 251, 0.8) 40%, rgba(249, 250, 251, 0) 100%)',
        }}
      />
      
      {/* 스크롤 컨테이너 - 부드러운 스크롤 */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-scroll scrollbar-hide select-none"
        style={{
          height: containerHeight,
          scrollSnapType: 'y mandatory',
          scrollBehavior: isDragging ? 'auto' : 'smooth',
          WebkitOverflowScrolling: 'touch',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDragStart={(e) => e.preventDefault()} // 드래그 시작 방지
      >
        {/* 패딩 (상단) */}
        <div style={{ height: itemHeight * centerIndex }} />
        
        {/* 아이템 리스트 */}
        <div>
          {items.map((item) => {
            const isSelected = item === value;
            const itemIndex = items.indexOf(item);
            const scrollTop = scrollContainerRef.current?.scrollTop || 0;
            const itemScrollPosition = itemIndex * itemHeight;
            const distanceFromCenter = Math.abs(scrollTop - itemScrollPosition + (itemHeight * centerIndex));
            const normalizedDistance = Math.min(distanceFromCenter / itemHeight, 1);
            
            // 거리에 따른 스케일 및 투명도 (더 부드러운 전환)
            const scale = isSelected ? 1 : Math.max(0.85, 1 - normalizedDistance * 0.15);
            const opacity = isSelected ? 1 : Math.max(0.3, 1 - normalizedDistance * 0.7);
            const fontSize = isSelected ? '1.375rem' : normalizedDistance < 0.3 ? '1.125rem' : '1rem';
            
            return (
              <div
                key={item}
                className="flex items-center justify-center transition-all duration-150 ease-out"
                style={{
                  height: itemHeight,
                  scrollSnapAlign: 'center',
                  scrollSnapStop: 'always',
                }}
              >
                <div
                  className={`transition-all duration-150 ease-out select-none ${
                    isSelected 
                      ? 'text-gray-900 font-semibold' 
                      : 'text-gray-400 font-normal'
                  }`}
                  style={{
                    fontSize: fontSize,
                    transform: `scale(${scale})`,
                    opacity: opacity,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                    pointerEvents: 'none', // 텍스트 클릭 방지
                  }}
                >
                  {formatLabel(item)}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* 패딩 (하단) */}
        <div style={{ height: itemHeight * centerIndex }} />
      </div>
    </div>
  );
}

