'use client';

import { useState, useEffect, useRef, startTransition, memo } from 'react';
import { useVMs } from '../hooks/useVMs';
import { useQueryClient } from '@tanstack/react-query';
import type { VM } from '../lib/types';
// WebSocket 완전 제거 - React Error #321 근본 해결
import dynamicImport from 'next/dynamic';
import Loading from './Loading';

// 동적 import: SnapshotManager는 조건부로만 렌더링되므로 코드 스플리팅 적용
const SnapshotManager = dynamicImport(
  () => import('./SnapshotManager'),
  {
    loading: () => <Loading message="Loading snapshot manager..." size="sm" />,
    ssr: false,
  }
);

interface VMListSectionProps {
  onAction?: (uuid: string, action: 'start' | 'stop' | 'restart' | 'delete') => void;
  onEdit?: (vm: VM | null) => void;
  processingId?: string | null;
  editingVM?: VM | null;
  selectedVMForSnapshot?: string | null;
  onSnapshotSelect?: (uuid: string | null) => void;
}

/**
 * VM List Section Component
 * Suspense와 완전 통합 - Streaming SSR 최적화
 */
export default function VMListSection({
  onAction,
  onEdit,
  processingId,
  editingVM,
  selectedVMForSnapshot,
  onSnapshotSelect,
}: VMListSectionProps) {
  // useQuery 사용: 로딩 상태 처리
  const { data: vmsData, isLoading } = useVMs();
  
  // 안전한 배열 처리
  const vms = Array.isArray(vmsData) ? vmsData : [];
  const queryClient = useQueryClient();
  
  // Carousel State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState<number>(0);
  // 모바일 터치 상태 관리 (VM UUID -> 터치 여부)
  const [touchedVM, setTouchedVM] = useState<string | null>(null);
  
  // 드래그/스와이프 상태
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  // React Error #310 완전 해결: useMemo 제거, 직접 계산 (hydration mismatch 방지)
  const cardWidth = windowWidth < 640 ? 280 : 240;
  const cardGap = 40; // 카드 간격 증가

  // 윈도우 크기 추적 (반응형 카루셀 계산용)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateWidth = () => {
      setWindowWidth(window.innerWidth);
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // vms 변경 시 인덱스 리셋
  useEffect(() => {
    if (vms.length > 0) {
      setCurrentIndex(0);
      setIsTransitioning(false);
      setDragOffset(0);
    }
  }, [vms.length]);

  // selectedVMForSnapshot 변경 시 해당 VM을 가운데로 이동
  useEffect(() => {
    if (selectedVMForSnapshot && vms.length > 0) {
      const targetIndex = vms.findIndex(vm => vm.uuid === selectedVMForSnapshot);
      if (targetIndex !== -1 && targetIndex !== currentIndex) {
        setIsTransitioning(true);
        setCurrentIndex(targetIndex);
        // 전환 완료 후 transition 상태 해제
        setTimeout(() => setIsTransitioning(false), 500);
      }
    }
  }, [selectedVMForSnapshot, vms, currentIndex]);

  // 전환 효과 제어 및 위치 업데이트
  useEffect(() => {
    if (!carouselRef.current || vms.length === 0) return;
    
    const totalCardWidth = cardWidth + cardGap;
    
    // 드래그 중이 아닐 때만 transition 적용
    if (!isDragging) {
      carouselRef.current.style.transition = isTransitioning 
        ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)' 
        : 'none';
    } else {
      carouselRef.current.style.transition = 'none';
    }
    
    // selectedVMForSnapshot가 있으면 해당 VM을 중앙에 배치
    let targetIndex = currentIndex;
    if (selectedVMForSnapshot) {
      const selectedIndex = vms.findIndex(vm => vm.uuid === selectedVMForSnapshot);
      if (selectedIndex !== -1) {
        targetIndex = selectedIndex;
      }
    }
    
    // 실제 인덱스 계산 (무한 루프를 위한 오프셋)
    const actualIndex = targetIndex < 0 
      ? vms.length - 1 
      : targetIndex >= vms.length 
        ? 0 
        : targetIndex;
    
    // 중앙 정렬을 위한 계산
    const containerWidth = containerRef.current?.offsetWidth || windowWidth || 800;
    const centerOffset = (containerWidth / 2) - (cardWidth / 2);
    const translateX = centerOffset - (actualIndex * totalCardWidth) + dragOffset;
    
    // 3D 효과를 위한 transform (perspective 유지)
    carouselRef.current.style.transform = `translateX(${translateX}px) translateZ(0)`;
  }, [currentIndex, isTransitioning, isDragging, dragOffset, windowWidth, vms.length, cardWidth, cardGap, selectedVMForSnapshot, vms]);

  // cleanup: animationFrame 정리
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // React Error #321 완전 해결: useCallback 완전 제거, ref 사용
  // 상태를 ref에 저장하여 의존성 제거
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const dragOffsetRef = useRef(0);
  const vmsLengthRef = useRef(vms.length);
  
  // vms.length 변경 시 ref 업데이트
  useEffect(() => {
    vmsLengthRef.current = vms.length;
  }, [vms.length]);

  // 드래그 시작 - useCallback 제거
  const handleDragStart = (clientX: number) => {
    isDraggingRef.current = true;
    startXRef.current = clientX;
    setIsDragging(true);
    setStartX(clientX);
    setCurrentX(clientX);
    setDragOffset(0);
    dragOffsetRef.current = 0;
  };

  // 드래그 중 - useCallback 제거
  const handleDragMove = (clientX: number) => {
    if (!isDraggingRef.current) return;
    
    const diff = clientX - startXRef.current;
    setCurrentX(clientX);
    setDragOffset(diff);
    dragOffsetRef.current = diff;
    
    // 애니메이션 프레임으로 부드러운 업데이트
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      // 드래그 오프셋이 너무 크면 다음/이전 카드로 스냅
      const threshold = (cardWidth + cardGap) * 0.3;
      if (Math.abs(diff) > threshold) {
        // 시각적 피드백만 제공
      }
    });
  };

  // React Error #321 완전 해결: useCallback 제거, startTransition 사용
  const goToNext = () => {
    if (vmsLengthRef.current === 0) return;
    startTransition(() => {
      setIsTransitioning(true);
      setCurrentIndex((prev) => (prev + 1) % vmsLengthRef.current);
    });
  };

  const goToPrevious = () => {
    if (vmsLengthRef.current === 0) return;
    startTransition(() => {
      setIsTransitioning(true);
      setCurrentIndex((prev) => (prev - 1 + vmsLengthRef.current) % vmsLengthRef.current);
    });
  };

  // 드래그 종료 - useCallback 제거
  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    
    isDraggingRef.current = false;
    setIsDragging(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    const totalCardWidth = cardWidth + cardGap;
    const threshold = totalCardWidth * 0.3;
    const offset = dragOffsetRef.current;
    
    if (Math.abs(offset) > threshold) {
      if (offset > 0) {
        goToPrevious();
      } else {
        goToNext();
      }
    } else {
      setDragOffset(0);
      dragOffsetRef.current = 0;
    }
  };

  // 데스크탑에서는 마우스 드래그 비활성화 (클릭만 사용)
  // 모바일에서만 터치 드래그 사용
  const handleTouchStart = (e: React.TouchEvent) => {
    // 모바일에서만 터치 드래그 허용
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (!isMobile) return;
    
    const touch = e.touches[0];
    if (touch) {
      handleDragStart(touch.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const touch = e.touches[0];
    if (touch) {
      e.preventDefault();
      handleDragMove(touch.clientX);
    }
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };


  // 키보드 네비게이션 - 의존성 제거
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // 의존성 배열 비움 - 무한 루프 방지

  // WebSocket 완전 비활성화 - React Error #321 근본 해결
  // React Query의 자동 리페치만 사용 (refetchInterval)
  // WebSocket 관련 코드 모두 제거

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  if (isLoading) {
    return (
      <div className="lg:col-span-2 p-4 sm:p-6 bg-white dark:bg-gray-800/90 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition-all backdrop-blur-sm min-h-[400px] flex flex-col">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Virtual Machines</h2>
        <div className="relative" role="status" aria-live="polite">
          <div className="overflow-hidden">
            <div className="flex gap-4 sm:gap-6 justify-center">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-56 h-[280px] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          <span className="sr-only">Loading virtual machines...</span>
        </div>
      </div>
    );
  }

  if (vms.length === 0) {
    return (
      <div className="lg:col-span-2 p-4 sm:p-6 bg-white dark:bg-gray-800/90 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition-all backdrop-blur-sm min-h-[400px] flex flex-col">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Virtual Machines</h2>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400" role="status">
          No VMs found.
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-2 p-4 sm:p-6 bg-white dark:bg-gray-800/90 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition-all backdrop-blur-sm flex flex-col" style={{ minHeight: '400px' }}>
      <h2 className="text-lg sm:text-xl font-semibold mb-4">Virtual Machines</h2>
      <div className="relative flex-1 overflow-hidden" role="region" aria-label="Virtual machines carousel" style={{ minHeight: '400px', paddingTop: '20px', paddingBottom: '20px' }}>
        {/* Carousel Container */}
        <div 
          ref={containerRef}
          className="relative w-full overflow-hidden"
          role="group" 
          aria-label={`Virtual machine ${currentIndex + 1} of ${vms.length}`}
          style={{ 
            height: '400px', 
            display: 'flex', 
            alignItems: 'center',
            perspective: '1200px',
            perspectiveOrigin: 'center center',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            ref={carouselRef}
            className="flex gap-10 gpu-accelerated select-none items-center"
            style={{
              transformStyle: 'preserve-3d',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            {vms.map((vm, index) => {
              // OS 타입에 따른 로고 결정
              const getOSLogo = (osType?: string) => {
                if (!osType || osType.trim() === '') {
                  return (
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#9CA3AF"/>
                      <path d="M12 2L15 9L12 7L9 9L12 2Z" fill="white"/>
                      <path d="M12 22L9 15L12 17L15 15L12 22Z" fill="white"/>
                      <path d="M2 12L9 9L7 12L9 15L2 12Z" fill="white"/>
                      <path d="M22 12L15 15L17 12L15 9L22 12Z" fill="white"/>
                    </svg>
                  );
                }
                const os = osType.toLowerCase().trim();
                
                if (os === 'ubuntu-desktop' || (os.includes('ubuntu') && os.includes('desktop'))) {
                  return (
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#E95420"/>
                      <circle cx="12" cy="12" r="8" fill="#77216F"/>
                      <circle cx="12" cy="12" r="6" fill="#5E2750"/>
                      <path d="M12 2L15 9L12 7L9 9L12 2Z" fill="white"/>
                      <path d="M12 22L9 15L12 17L15 15L12 22Z" fill="white"/>
                      <path d="M2 12L9 9L7 12L9 15L2 12Z" fill="white"/>
                      <path d="M22 12L15 15L17 12L15 9L22 12Z" fill="white"/>
                    </svg>
                  );
                } else if (os === 'ubuntu-server' || (os.includes('ubuntu') && os.includes('server'))) {
                  return (
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#E95420"/>
                      <circle cx="12" cy="12" r="8" fill="#77216F"/>
                      <circle cx="12" cy="12" r="6" fill="#5E2750"/>
                      <path d="M12 2L15 9L12 7L9 9L12 2Z" fill="white"/>
                      <path d="M12 22L9 15L12 17L15 15L12 22Z" fill="white"/>
                      <path d="M2 12L9 9L7 12L9 15L2 12Z" fill="white"/>
                      <path d="M22 12L15 15L17 12L15 9L22 12Z" fill="white"/>
                    </svg>
                  );
                } else if (os === 'kali' || os.includes('kali')) {
                  return (
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#557C94"/>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#557C94"/>
                      <path d="M8 10c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm4 4c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="#557C94"/>
                      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#557C94"/>
                    </svg>
                  );
                } else if (os === 'windows' || os.includes('windows')) {
                  return (
                    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none">
                      <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" fill="#0078D4"/>
                    </svg>
                  );
                }
                return null;
              };

              const osLogo = getOSLogo(vm.os_type);
              const isTouched = touchedVM === vm.uuid;
              
              const isActive = index === currentIndex;
              
              // 중앙에서의 거리 계산 (3D 효과용)
              const distanceFromCenter = Math.abs(index - currentIndex);
              const isCenter = distanceFromCenter === 0;
              const isNearCenter = distanceFromCenter === 1;
              
              // 3D 변환 계산
              const containerWidth = containerRef.current?.offsetWidth || windowWidth || 800;
              const totalCardWidth = cardWidth + cardGap;
              
              // 카드의 실제 화면 위치 계산 (carouselRef의 translateX 고려)
              const centerOffset = (containerWidth / 2) - (cardWidth / 2);
              const actualIndex = currentIndex < 0 
                ? vms.length - 1 
                : currentIndex >= vms.length 
                  ? 0 
                  : currentIndex;
              const carouselTranslateX = centerOffset - (actualIndex * totalCardWidth) + dragOffset;
              
              const cardLeft = (index * totalCardWidth) + carouselTranslateX;
              const cardCenter = cardLeft + (cardWidth / 2);
              const containerCenter = containerWidth / 2;
              const offsetFromCenter = cardCenter - containerCenter;
              const maxOffset = containerWidth / 2;
              
              // 카드가 컨테이너 밖에 있으면 렌더링하지 않음 (성능 최적화 및 overflow 방지)
              const cardRight = cardLeft + cardWidth;
              const isVisible = cardRight > -cardWidth && cardLeft < containerWidth + cardWidth;
              
              // 회전 방향: 
              // - 왼쪽 카드(offsetFromCenter < 0): 오른쪽으로 기울어야 함 (양수 rotationY)
              // - 오른쪽 카드(offsetFromCenter > 0): 왼쪽으로 기울어야 함 (음수 rotationY)
              // 따라서 offsetFromCenter의 부호를 반대로 해야 함
              const rotationY = isCenter ? 0 : -(offsetFromCenter / maxOffset) * 15; // 부호 반대로
              const translateZ = isCenter ? 30 : isNearCenter ? 15 : 0; // z축 이동
              const scale = isCenter ? 1.1 : isNearCenter ? 1.05 : 0.92; // 스케일
              const opacity = isCenter ? 1 : isNearCenter ? 0.9 : 0.75; // 투명도
              
              // 카드가 보이지 않으면 렌더링하지 않음
              if (!isVisible) {
                return null;
              }
              
              return (
                <article
                  key={vm.uuid}
                  className={`relative rounded-xl p-4 hover:shadow-lg transition-all duration-500 flex flex-col w-[280px] sm:w-[240px] flex-shrink-0 h-[320px] group ${
                    isTouched ? 'active' : ''
                  } ${
                    isActive 
                      ? 'bg-blue-50/50 dark:bg-blue-900/20' 
                      : 'bg-white dark:bg-gray-800'
                  }`}
                  style={{
                    border: isActive 
                      ? '2px solid transparent'
                      : '2px solid rgb(229 231 235 / 0.5)',
                    backgroundImage: isActive
                      ? (() => {
                          const isDark = typeof window !== 'undefined' && (document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches);
                          const bgColor = isDark ? 'rgb(31 41 55)' : 'white';
                          return `linear-gradient(${bgColor}, ${bgColor}), linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)`;
                        })()
                      : undefined,
                    backgroundOrigin: isActive ? 'border-box' : undefined,
                    backgroundClip: isActive ? 'padding-box, border-box' : undefined,
                    transform: `perspective(1000px) rotateY(${rotationY}deg) translateZ(${translateZ}px) scale(${scale})`,
                    transformStyle: 'preserve-3d',
                    opacity: opacity,
                    zIndex: isCenter ? 30 : isNearCenter ? 20 : 10,
                    boxShadow: isCenter 
                      ? '0 20px 40px -10px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                      : isNearCenter
                      ? '0 10px 20px -5px rgba(0, 0, 0, 0.2)'
                      : '0 4px 6px -2px rgba(0, 0, 0, 0.1)',
                    filter: isCenter ? 'brightness(1.05)' : isNearCenter ? 'brightness(0.98)' : 'brightness(0.95)',
                  }}
                  aria-label={`Virtual machine: ${vm.name}, Status: ${vm.status}, CPU: ${vm.cpu} cores, Memory: ${formatBytes(vm.memory * 1024 * 1024)}`}
                  role="button"
                  tabIndex={isCenter ? 0 : -1}
                  onKeyDown={(e) => {
                    // 키보드 네비게이션: Enter/Space로 카드 이동
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!isCenter && index !== currentIndex) {
                        setIsTransitioning(true);
                        setCurrentIndex(index);
                        setTimeout(() => setIsTransitioning(false), 500);
                      }
                    }
                    // 화살표 키로 카드 이동
                    if (e.key === 'ArrowLeft' && index > 0) {
                      e.preventDefault();
                      setIsTransitioning(true);
                      setCurrentIndex(index - 1);
                      setTimeout(() => setIsTransitioning(false), 500);
                    }
                    if (e.key === 'ArrowRight' && index < vms.length - 1) {
                      e.preventDefault();
                      setIsTransitioning(true);
                      setCurrentIndex(index + 1);
                      setTimeout(() => setIsTransitioning(false), 500);
                    }
                  }}
                  onClick={(e) => {
                    // 모바일에서는 드래그만 사용, 클릭은 액션 버튼 표시용
                    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
                    
                    if (isMobile) {
                      // 모바일: 터치 드래그 중이 아닐 때만 액션 버튼 표시
                      if (!isDragging) {
                        e.stopPropagation();
                        setTouchedVM(isTouched ? null : vm.uuid);
                      }
                      return;
                    }
                    
                    // 데스크탑: 클릭으로 카드 이동 (드래그 없음)
                    if (!isCenter && index !== currentIndex) {
                      e.stopPropagation();
                      setIsTransitioning(true);
                      setCurrentIndex(index);
                      setTimeout(() => setIsTransitioning(false), 500);
                    }
                  }}
                  onTouchStart={(e) => {
                    // 드래그와 충돌 방지 - 터치 시작 시점에는 드래그가 아니므로 항상 처리
                    // 모바일에서 터치 시 액션 버튼 표시
                    if (typeof window !== 'undefined' && window.innerWidth < 640) {
                      e.stopPropagation();
                      setTouchedVM(vm.uuid);
                    }
                  }}
                  onTouchEnd={(e) => {
                    // 터치 종료 시 즉시 리셋하지 않고 약간의 지연을 두어 버튼 클릭 가능하게
                    // 모바일에서만 처리
                    if (typeof window !== 'undefined' && window.innerWidth < 640) {
                      e.stopPropagation();
                      // 터치 종료 후에도 버튼이 보이도록 더 긴 시간 유지
                      setTimeout(() => {
                        // 다른 VM이 터치되지 않았을 때만 리셋
                        if (touchedVM === vm.uuid) {
                          setTouchedVM(null);
                        }
                      }, 2000); // 2초로 증가하여 충분한 시간 제공
                    }
                  }}
                  onTouchCancel={(e) => {
                    // 터치 취소 시 즉시 리셋
                    if (typeof window !== 'undefined' && window.innerWidth < 640) {
                      e.stopPropagation();
                      setTouchedVM(null);
                    }
                  }}
                >
                  {/* VM 정보 */}
                  <div className="space-y-2 text-center flex-1 flex flex-col justify-between">
                    {/* OS 로고 (상단, 항상 표시) */}
                    <div className="flex justify-center mb-2" aria-hidden="true">
                      <div className="flex items-center justify-center">
                        {osLogo}
                      </div>
                    </div>
                    
                    {/* 이름, 스펙, 상태 영역 */}
                    <div className="group relative flex-1 flex flex-col justify-center min-h-[120px]">
                      {/* 기본 내용 (이름, 스펙, 상태) - 활성화된 카드에만 호버/터치 시 숨김 */}
                      <div className={`transition-opacity duration-200 flex flex-col gap-2 ${
                        isActive 
                          ? 'group-hover:opacity-0 group-hover:pointer-events-none group-[.active]:opacity-0 group-[.active]:pointer-events-none' 
                          : 'opacity-100 pointer-events-auto'
                      }`}>
                        {/* VM 이름 */}
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate px-1" title={vm.name}>
                          <span className="sr-only">Virtual machine name: </span>
                          {vm.name}
                        </h3>
                        
                        {/* 스펙 */}
                        <div className="flex flex-col gap-1.5 items-center">
                          <div className="flex items-center gap-2 text-sm justify-center">
                            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{vm.cpu} vCPU</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm justify-center">
                            <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{formatBytes(vm.memory * 1024 * 1024)}</span>
                          </div>
                        </div>

                        {/* 상태 */}
                        <div className="flex justify-center">
                          <span 
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              vm.status === 'Running' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 
                              vm.status === 'Stopped' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                              'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            }`}
                            role="status"
                            aria-label={`VM status: ${vm.status}`}
                          >
                            {vm.status}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons (shown on hover/touch for active card only) */}
                      <div className={`absolute inset-0 transition-opacity duration-200 flex items-center justify-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg ${
                        isActive && isTouched
                          ? 'opacity-100 pointer-events-auto'
                          : isActive
                            ? 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                            : 'opacity-0 pointer-events-none'
                      }`}>
                        <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto px-2">
                          {/* Row 1: Start, Restart, Stop */}
                          {onAction && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction(vm.uuid, 'start');
                              }}
                              disabled={processingId === vm.uuid || vm.status === 'Running'}
                              aria-label={`Start virtual machine ${vm.name}`}
                              className="w-10 h-10 flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          {onAction && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction?.(vm.uuid, 'restart');
                                setTouchedVM(null);
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (!processingId && vm.status === 'Running') {
                                  onAction?.(vm.uuid, 'restart');
                                  setTouchedVM(null);
                                }
                              }}
                              disabled={processingId === vm.uuid || vm.status !== 'Running'}
                              aria-label={`Restart virtual machine ${vm.name}`}
                              className="w-10 h-10 flex items-center justify-center text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          {onAction && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction?.(vm.uuid, 'stop');
                                setTouchedVM(null);
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (!processingId && vm.status === 'Running') {
                                  onAction?.(vm.uuid, 'stop');
                                  setTouchedVM(null);
                                }
                              }}
                              disabled={processingId === vm.uuid || vm.status !== 'Running'}
                              aria-label={`Stop virtual machine ${vm.name}`}
                              className="w-10 h-10 flex items-center justify-center text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9v-4z" />
                              </svg>
                            </button>
                          )}
                          {/* Row 2: VNC, Edit, Snapshot */}
                          <a 
                            href={`/vnc/${vm.uuid}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (vm.status !== 'Running') {
                                e.preventDefault();
                                return;
                              }
                              setTouchedVM(null);
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                              if (vm.status === 'Running') {
                                window.location.href = `/vnc/${vm.uuid}`;
                                setTouchedVM(null);
                              } else {
                                e.preventDefault();
                              }
                            }}
                            aria-label={`Open VNC console for ${vm.name}`}
                            className={`w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${vm.status !== 'Running' ? 'pointer-events-none opacity-30' : ''}`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </a>
                          {/* Row 2: Edit, Snapshot, Delete */}
                          {onEdit && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(editingVM?.uuid === vm.uuid ? null : vm);
                              }}
                              disabled={processingId === vm.uuid || vm.status === 'Running'}
                              aria-label={`Edit virtual machine ${vm.name}`}
                              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {onSnapshotSelect && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onSnapshotSelect(selectedVMForSnapshot === vm.uuid ? null : vm.uuid);
                              }}
                              aria-label={`Manage snapshots for ${vm.name}`}
                              className={`w-10 h-10 flex items-center justify-center text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors ${selectedVMForSnapshot === vm.uuid ? 'bg-purple-100 dark:bg-purple-900/30' : ''}`}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                            </button>
                          )}
                          {onAction && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onAction(vm.uuid, 'delete');
                              }}
                              disabled={processingId === vm.uuid}
                              aria-label={`Delete virtual machine ${vm.name}`}
                              className="w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* UUID (맨 하단) */}
                    <div className="pt-1.5 border-t border-gray-100 dark:border-gray-700 mt-auto">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(vm.uuid || '');
                        }}
                        className="w-full text-xs text-gray-400 dark:text-gray-500 font-mono hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer transition-colors text-center truncate"
                        aria-label={`Copy UUID for ${vm.name}`}
                      >
                        {vm.uuid ? `${vm.uuid.substring(0, 8)}...` : 'N/A'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        

        {/* 인디케이터 (점 표시) */}
        {vms.length > 1 && (
          <div className="flex justify-center gap-2 mt-4" role="tablist" aria-label="VM carousel indicators">
            {vms.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsTransitioning(true);
                  setCurrentIndex(index);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 bg-blue-600 dark:bg-blue-500'
                    : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                }`}
                aria-label={`Go to VM ${index + 1}`}
                aria-selected={index === currentIndex}
                role="tab"
              />
            ))}
          </div>
        )}
      </div>

      {/* Snapshot Manager */}
      {selectedVMForSnapshot && vms.find(vm => vm.uuid === selectedVMForSnapshot) && (
        <div className="mt-4">
          <SnapshotManager 
            vmUuid={selectedVMForSnapshot} 
            vmName={vms.find(vm => vm.uuid === selectedVMForSnapshot)!.name} 
          />
        </div>
      )}
    </div>
  );
}
