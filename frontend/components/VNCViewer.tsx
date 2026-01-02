'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { handleError } from '../lib/utils/error';
import { vmAPI } from '../lib/api/index';
import { logger } from '../lib/utils/logger';

// RFB type from @novnc/novnc (simplified interface)
interface RFBInstance {
  connect: (url: string) => void;
  disconnect: () => void;
  sendCredentials: (password: string) => void;
  sendKey: (keysym: number, code: number, down: boolean) => void;
  sendPointerEvent: (x: number, y: number, buttonMask: number) => void;
  addEventListener: (event: string, handler: (e: unknown) => void) => void;
  removeEventListener: (event: string, handler: (e: unknown) => void) => void;
}

export default function VNCViewer({ uuid }: { uuid: string }) {
  const rfbRef = useRef<RFBInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting...');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [mountedMedia, setMountedMedia] = useState<Array<{ type: string; source: string; target: string }>>([]);
  const [showMountDialog, setShowMountDialog] = useState(false);
  const [isoPath, setIsoPath] = useState('');
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastResizeTimeRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const hasConnectedRef = useRef<boolean>(false); // Track if we've ever successfully connected
  const vmStatusCheckAttemptsRef = useRef<number>(0);
  const MAX_VM_STATUS_CHECK_ATTEMPTS = 3; // Maximum retry attempts for VM status check
  const abortControllerRef = useRef<AbortController | null>(null);

  // VM Restart - React Error #321 fix: Remove useCallback
  const handleRestart = async () => {
    if (isProcessing) return;
    if (!confirm('Restart VM? Media state will be preserved.')) {
      return;
    }

    setIsProcessing(true);
    setStatus('Restarting...');
    try {
      await vmAPI.action(uuid, 'restart', {});
      setStatus('VM restarting... Connection will resume shortly.');
      // Auto-reconnect after restart is handled by WebSocket
    } catch (error: any) {
        handleError(error, { component: 'VNCViewer', action: 'restart' });
      setStatus(`Error: ${error.message || 'Failed to restart VM'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Available ISO files
  const [availableISOs, setAvailableISOs] = useState<Array<{ name: string; path: string; size: number; modified: string }>>([]);
  const [isLoadingISOs, setIsLoadingISOs] = useState(false);

  // Load current media and available ISOs - React Error #321 해결: useCallback 제거
  const loadMountedMedia = async () => {
    try {
      const result = await vmAPI.getMedia(uuid);
      if (result.attached && result.media_path) {
        setMountedMedia([{
          type: 'cdrom',
          source: result.media_path,
          target: 'hda' // Default target
        }]);
      } else {
        setMountedMedia([]);
      }
    } catch (error: any) {
      // If 404 or error, assume no media attached
      if (error?.status === 404 || error?.message?.includes('Not Found')) {
        setMountedMedia([]);
        return;
      }
      // Log media loading errors
      logger.warn(`[VNCViewer] Failed to load media: ${error instanceof Error ? error.message : String(error)}`);
      setMountedMedia([]);
    }
  };

  // Load available ISO files - React Error #321 해결: useCallback 제거
  const loadAvailableISOs = async () => {
    setIsLoadingISOs(true);
    try {
      const result = await vmAPI.getISOs();
      setAvailableISOs(result.isos || []);
    } catch (error: any) {
      logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'VNCViewer', action: 'load_iso_list' });
      setAvailableISOs([]);
    } finally {
      setIsLoadingISOs(false);
    }
  };

  // Disable Media (비활성화 - 나중에 다시 활성화 가능) - React Error #321 해결: useCallback 제거
  const handleDetachMedia = async () => {
    if (isProcessing) return;
    
    if (!confirm('Disable ISO/CDROM media?\n\nYou can reattach it later from the ISO list.')) {
      return;
    }

    setIsProcessing(true);
    setStatus('Disabling media...');
    try {
      const result = await vmAPI.media(uuid, 'detach');
      
      // Use backend message (includes "Media disabled successfully. You can reattach it later.")
      setStatus(result.message || 'Media disabled successfully. You can reattach it later.');
      
      // Store previous media path if available (for potential reattach suggestion)
      if (result.previous_media_path && process.env.NODE_ENV === 'development') {
        logger.log('[VNCViewer] Previous media path:', result.previous_media_path);
      }
      
      // Immediately clear local state
      setMountedMedia([]);
      
      // Wait a bit for backend to process, then reload media state to confirm
      setTimeout(async () => {
        try {
          await loadMountedMedia();
        } catch (err) {
          logger.error(err instanceof Error ? err : new Error(String(err)), { component: 'VNCViewer', action: 'reload_media_after_disable' });
        }
      }, 1500);
    } catch (error: any) {
        handleError(error, { component: 'VNCViewer', action: 'detach_media' });
      
      // Enhanced error message handling
      let errorMessage = 'Failed to disable media';
      if (error?.responseData?.message) {
        errorMessage = error.responseData.message;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      // If it's a 500 error, provide more helpful message
      if (error?.status === 500 || errorMessage.includes('Internal server error')) {
        errorMessage = 'Server error occurred. The media may still be enabled. Please try refreshing or contact support.';
      }
      
      setStatus(`Error: ${errorMessage}`);
      
      // Even on error, try to reload media state to see current status
      setTimeout(async () => {
        try {
          await loadMountedMedia();
        } catch (err) {
          logger.error(err instanceof Error ? err : new Error(String(err)), { component: 'VNCViewer', action: 'reload_media_after_disable_error' });
        }
      }, 1500);
    } finally {
      setIsProcessing(false);
    }
  };

  // Attach Media
  const handleAttachMedia = async () => {
    if (isProcessing || !isoPath.trim()) return;

    setIsProcessing(true);
    setStatus('Mounting media...');
    try {
      const result = await vmAPI.media(uuid, 'attach', isoPath.trim());
      setStatus(result.message || `Media mounted: ${isoPath}`);
      setIsoPath('');
      setShowMountDialog(false);
      // Reload media state
      setTimeout(() => loadMountedMedia(), 1000);
    } catch (error: any) {
        handleError(error, { component: 'VNCViewer', action: 'attach_media' });
      setStatus(`Error: ${error.message || 'Failed to attach media'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load media and ISO list on mount - React Error #321 해결: 의존성 배열에서 함수 제거
  useEffect(() => {
    loadMountedMedia();
    loadAvailableISOs();
    
    // Refresh media list periodically
    const interval = setInterval(() => {
      loadMountedMedia();
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]); // uuid만 의존성으로 사용

  // 전체화면 진입/종료 핸들러 - useCallback으로 최적화
  const toggleFullscreen = useCallback(async () => {
    if (!viewerRef.current) return;

    try {
      if (!isFullscreen) {
        // 전체화면 진입
        const element = viewerRef.current;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          await (element as any).webkitRequestFullscreen();
        } else if ((element as any).mozRequestFullScreen) {
          await (element as any).mozRequestFullScreen();
        } else if ((element as any).msRequestFullscreen) {
          await (element as any).msRequestFullscreen();
        }
      } else {
        // 전체화면 종료
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'VNCViewer', action: 'fullscreen' });
    }
  }, [isFullscreen]);

  // 전체화면 상태 변경 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      
      // 전체화면 상태 변경 시 컨테이너 크기 업데이트
      setTimeout(() => {
        if (containerRef.current) {
          const headerHeight = isCurrentlyFullscreen ? 0 : 48;
          const availableHeight = window.innerHeight - headerHeight;
          const availableWidth = window.innerWidth;
          containerRef.current.style.width = `${availableWidth}px`;
          containerRef.current.style.height = `${availableHeight}px`;
        }
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // noVNC CSS는 필요하지 않음 (noVNC는 CSS 없이도 완전히 작동)
  // CDN 로드 문제를 완전히 제거

  // F11 키로 전체화면 토글
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 키로 전체화면 토글 (VNC 컨테이너에 포커스가 있을 때는 noVNC가 처리하므로 제외)
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleFullscreen]);

  // Throttled resize handler to prevent excessive calls - 모바일 최적화
  // Phase 4: useCallback으로 최적화하여 useEffect 의존성 배열 안정화
  const handleResize = useCallback(() => {
    if (!containerRef.current) return;
    
    const now = Date.now();
    const timeSinceLastResize = now - lastResizeTimeRef.current;
    
    // 모바일에서는 더 긴 throttle 시간 사용 (성능 최적화)
    const throttleTime = typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 200;
    
    // Throttle to maximum once per throttleTime
    if (timeSinceLastResize < throttleTime) {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        handleResize();
      }, throttleTime - timeSinceLastResize);
      return;
    }
    
    lastResizeTimeRef.current = now;
    
    // Calculate available height (viewport height minus header)
    const headerHeight = isFullscreen ? 0 : 48;
    const availableHeight = window.innerHeight - headerHeight;
    const availableWidth = window.innerWidth;
    
    // Only update if size actually changed to prevent unnecessary DOM manipulation
    const currentWidth = containerRef.current.offsetWidth;
    const currentHeight = containerRef.current.offsetHeight;
    
    if (Math.abs(currentWidth - availableWidth) > 1 || Math.abs(currentHeight - availableHeight) > 1) {
      containerRef.current.style.width = `${availableWidth}px`;
      containerRef.current.style.height = `${availableHeight}px`;
    }
    
    // NO window.dispatchEvent - this was causing infinite loops!
    // noVNC will handle resize automatically through its own mechanisms
  }, [isFullscreen]);

  useEffect(() => {
    // Construct WebSocket URL
    // 환경에 따라 올바른 URL 결정 (프로덕션은 상대 경로, 개발은 환경 변수 또는 localhost)
    let wsUrl: string;
    let urlSource: string;
    
    // 프로덕션 환경 감지
    const isProduction = typeof window !== 'undefined' && 
      (window.location.hostname === 'limen.kr' || window.location.hostname === 'www.limen.kr');
    
    if (isProduction) {
      // 프로덕션: Envoy 프록시를 통한 상대 경로 사용
      // 백엔드가 /vnc/{uuid} 경로를 지원하므로 path parameter 형식 사용
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      // 백엔드가 /vnc/{uuid}를 지원하므로 path parameter 형식 사용
      wsUrl = `${protocol}://${window.location.host}/vnc/${uuid}`;
      urlSource = 'production-relative-path-vnc-uuid';
      
      // 프로덕션에서 환경 변수가 잘못 설정되어 있으면 경고
      if (process.env.NEXT_PUBLIC_BACKEND_URL) {
        logger.warn('[VNCViewer] NEXT_PUBLIC_BACKEND_URL is set in production but will be ignored. Using relative path for Envoy proxy.');
      }
    } else {
      // 개발 환경: 환경 변수 검증 후 사용
      if (process.env.NEXT_PUBLIC_BACKEND_URL) {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL.trim();
        
        // 환경 변수 값 검증
        if (!backendUrl || backendUrl === 'api' || backendUrl === '/api') {
          logger.error(new Error(`Invalid NEXT_PUBLIC_BACKEND_URL: ${backendUrl}`), { component: 'VNCViewer', action: 'parse_backend_url' });
          // ⚠️ 중요: 백엔드는 다른 서버이므로 내부망 IP 사용
          // 백엔드가 /vnc/{uuid}를 지원하므로 path parameter 형식 사용
          wsUrl = `ws://10.0.0.100:18443/vnc/${uuid}`;
          urlSource = 'fallback-internal-network-vnc-uuid';
        } else {
          // 유효한 환경 변수 사용
          const protocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
          const backendHost = backendUrl.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '');
          
          if (backendHost && backendHost.includes(':')) {
            // 포트가 포함된 호스트 (예: localhost:18443, 10.0.0.100:18443)
            // 백엔드가 /vnc/{uuid}를 지원하므로 path parameter 형식 사용
            wsUrl = `${protocol}://${backendHost}/vnc/${uuid}`;
            urlSource = 'env-var-with-port-vnc-uuid';
          } else if (backendHost) {
            // 호스트만 있는 경우 (포트는 프로토콜에 따라 기본값 사용)
            // 백엔드가 /vnc/{uuid}를 지원하므로 path parameter 형식 사용
            wsUrl = `${protocol}://${backendHost}/vnc/${uuid}`;
            urlSource = 'env-var-host-only-vnc-uuid';
          } else {
            logger.error(new Error(`Could not parse NEXT_PUBLIC_BACKEND_URL: ${backendUrl}`), { component: 'VNCViewer', action: 'parse_backend_url' });
            wsUrl = `ws://localhost:18443/vnc/${uuid}`;
            urlSource = 'fallback-localhost-vnc-uuid';
          }
        }
      } else {
        // 환경 변수가 없으면 내부망 IP 사용 (백엔드는 다른 서버)
        // ⚠️ 중요: 백엔드는 10.0.0.100, 프론트엔드는 10.0.0.10
        // 백엔드가 /vnc/{uuid}를 지원하므로 path parameter 형식 사용
        wsUrl = `ws://10.0.0.100:18443/vnc/${uuid}`;
        urlSource = 'default-internal-network-vnc-uuid';
      }
    }
    
    // VNC WebSocket 연결 설정
    // 백엔드 권장 방식: Path parameter + Cookie (쿠키는 자동으로 전송됨)
    // 또는 Path parameter + Authorization header
    // 하위 호환: Query parameter (?token=...)
    const setupVNCConnection = async () => {
      // 쿠키 기반 인증이 우선이므로, 쿠키가 자동으로 전송됨
      // 백엔드가 쿠키에서 refresh_token을 읽어서 인증 처리
      // 따라서 query parameter는 선택사항 (하위 호환용)
      
      // Phase 4: 보안 강화 - localStorage 직접 사용 제거, tokenManager만 사용
      let accessToken: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          const { tokenManager } = await import('../lib/tokenManager');
          accessToken = await tokenManager.getAccessToken();
        } catch (error) {
          logger.warn(`[VNCViewer] Failed to get access token: ${error instanceof Error ? error.message : String(error)}`);
          // localStorage 직접 사용 제거 - tokenManager를 통해서만 토큰 접근
        }
      }
      
      // 올바른 형식: Path parameter + Query parameter (하위 호환)
      // ❌ 잘못된 형식: wss://limen.kr/vnc/{uuid}&token=... (앰퍼샌드 사용)
      // ✅ 올바른 형식: wss://limen.kr/vnc/{uuid}?token=... (물음표 사용)
      // 쿠키는 자동으로 전송되므로 query parameter는 선택사항
      const finalUrl = accessToken 
        ? `${wsUrl}?token=${encodeURIComponent(accessToken)}`
        : wsUrl;
      
      logger.log('[VNCViewer] WebSocket URL:', {
        url: finalUrl.replace(/token=[^&?]+/, 'token=***'),
        hasToken: !!accessToken,
        urlFormat: 'Path parameter + Query parameter (fallback)',
        note: '쿠키는 자동으로 전송됨 (refresh_token)',
      });
      
      return finalUrl;
    };
    
    let rfb: any;

    // Check VM status before attempting VNC connection
    // Exponential backoff와 최대 재시도 횟수 적용
    const checkVMAndConnect = async (url: string, retryCount: number = 0): Promise<void> => {
      // 이전 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // 새로운 AbortController 생성
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      try {
        setStatus(retryCount > 0 ? `Checking VM status... (retry ${retryCount}/${MAX_VM_STATUS_CHECK_ATTEMPTS})` : 'Checking VM status...');
        
        // 타임아웃 설정 (10초)
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, 10000);
        
        const vms = await vmAPI.list();
        clearTimeout(timeoutId);
        
        if (abortController.signal.aborted) {
          return; // 요청이 취소됨
        }
        
        const vm = vms.find(v => v.uuid === uuid);
        
        if (!vm) {
          setStatus('VM not found');
          logger.error(new Error(`VM not found: ${uuid}`), { component: 'VNCViewer', action: 'check_vm_status', uuid });
          return;
        }
        
        logger.log('[VNCViewer] VM status:', vm.status);
        
        if (vm.status !== 'Running') {
          setStatus(`VM is not running. Current status: ${vm.status}. Please start the VM first.`);
          logger.warn(`[VNCViewer] VM is not running (status: ${vm.status}), aborting VNC connection`);
          return;
        }
        
        // VM is running, proceed with VNC connection
        logger.log('[VNCViewer] VM is running, proceeding with VNC connection');
        setStatus('Connecting to VNC...');
        vmStatusCheckAttemptsRef.current = 0; // 성공 시 재시도 카운터 리셋
        connect(url);
      } catch (error: any) {
        // AbortController로 취소된 경우
        if (error?.name === 'AbortError' || abortController.signal.aborted) {
          logger.warn('[VNCViewer] VM status check aborted');
          return;
        }
        
        // NetworkError는 네트워크 문제이므로 재시도
        const isNetworkError = error?.name === 'TypeError' && error?.message?.includes('NetworkError');
        
        if (isNetworkError && retryCount < MAX_VM_STATUS_CHECK_ATTEMPTS) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryCount) * 1000;
          logger.warn(`[VNCViewer] NetworkError during VM status check, retrying in ${delay}ms (${retryCount + 1}/${MAX_VM_STATUS_CHECK_ATTEMPTS})...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // 재시도
          return checkVMAndConnect(url, retryCount + 1);
        }
        
        // 최대 재시도 횟수 초과 또는 다른 에러
        if (isNetworkError) {
          logger.warn('[VNCViewer] NetworkError during VM status check after max retries, proceeding with VNC connection anyway');
          setStatus('Connecting to VNC... (VM status check failed, attempting connection)');
          vmStatusCheckAttemptsRef.current = 0; // 리셋
          connect(url);
          return;
        }
        
        // VNC graphics not found 에러 확인
        const errorMessage = error?.message || error?.responseData?.message || error?.response?.data?.message || '';
        if (errorMessage.includes('VNC graphics not found') || errorMessage.includes('VNC graphics') || errorMessage.includes('graphics not found')) {
          setStatus('VNC Connection Failed: VNC graphics not configured for this VM. Please ensure the VM has VNC graphics enabled in its configuration.');
          handleError(new Error(`VNC Connection Failed: VNC graphics not found`), {
            component: 'VNCViewer',
            action: 'checkVMAndConnect',
            reason: errorMessage,
            uuid,
            type: 'VM_CONFIG_ERROR',
          });
          return; // Do not attempt connection if VNC graphics not found
        }
        
        logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'VNCViewer', action: 'check_vm_status' });
        setStatus(`Error: Failed to check VM status - ${error.message || 'Unknown error'}`);
        // Don't try to connect if we can't check status - it will likely fail anyway
      } finally {
        if (!abortController.signal.aborted) {
          abortControllerRef.current = null;
        }
      }
    };

    const connect = async (url: string) => {
      try {
        if (typeof window === 'undefined') return;
        
        // Reset reconnect attempts when manually connecting
        reconnectAttemptsRef.current = 0;
        hasConnectedRef.current = false; // Reset connection status
        
        setStatus('Connecting to VNC...');
        logger.log('[VNCViewer] Starting VNC connection...', { url: url.replace(/token=[^&]+/, 'token=***') });

        // noVNC 동적 import (1.7.0-beta: ESM 모듈)
        // package.json의 "exports": "./core/rfb.js"에 따라
        // @novnc/novnc를 import하면 자동으로 core/rfb.js가 로드됨
        let RFB: any;
        try {
          // @ts-ignore - noVNC 타입 정의 없음
          // Turbopack의 resolveAlias를 통해 올바른 경로로 resolve됨
          const rfbModule = await import('@novnc/novnc');
          // ESM 모듈이므로 default export가 RFB 클래스
          RFB = rfbModule.default || rfbModule.RFB || rfbModule;
          if (!RFB) {
            throw new Error('RFB class not found in module');
          }
          logger.log('[VNCViewer] noVNC imported successfully:', { 
            hasRFB: !!rfbModule.RFB, 
            hasDefault: !!rfbModule.default,
            RFBType: typeof RFB,
            keys: Object.keys(rfbModule).slice(0, 10)
          });
        } catch (e) {
          logger.error(e instanceof Error ? e : new Error(String(e)), { component: 'VNCViewer', action: 'import_novnc' });
          setStatus('Error: Failed to load VNC client');
          throw e;
        }

        if (!containerRef.current || !RFB) return;

        // 컨테이너에 포커스를 받을 수 있도록 설정 (키보드 입력을 위해 필수)
        containerRef.current.setAttribute('tabindex', '0');
        containerRef.current.style.outline = 'none';
        
        // 클릭 시 포커스를 받도록 설정
        const handleContainerClick = () => {
          if (containerRef.current) {
            containerRef.current.focus();
          }
        };
        containerRef.current.addEventListener('click', handleContainerClick);

        // Create RFB connection
        // 백엔드가 쿠키 기반 인증을 지원하므로 credentials는 필요 없음
        // 쿠키는 자동으로 전달됨 (credentials: 'include'는 noVNC 내부에서 처리)
        rfb = new RFB(containerRef.current, url, {
          // credentials는 noVNC가 자동으로 처리 (쿠키 전달)
        });
        
        // 클린업 함수 설정 (rfb 생성 후)
        (rfb as any)._clickCleanup = () => {
          if (containerRef.current) {
            containerRef.current.removeEventListener('click', handleContainerClick);
          }
        };

        // Configure VNC scaling and sizing
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfb.background = 'black';
        
        // Initial resize
        const updateContainerSize = () => {
          if (containerRef.current) {
            const headerHeight = isFullscreen ? 0 : 48;
            const availableHeight = window.innerHeight - headerHeight;
            const availableWidth = window.innerWidth;
            containerRef.current.style.width = `${availableWidth}px`;
            containerRef.current.style.height = `${availableHeight}px`;
          }
        };
        
        setTimeout(updateContainerSize, 100);
        
        // Listen for window resize
        window.addEventListener('resize', handleResize);
        
        // Cleanup resize listener
        const cleanupResize = () => {
          window.removeEventListener('resize', handleResize);
          if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = null;
          }
        };
        
        (rfb as any)._resizeCleanup = cleanupResize;

        rfb.addEventListener('connect', () => {
          logger.log('[VNCViewer] RFB Connected successfully');
          setStatus('Connected');
          reconnectAttemptsRef.current = 0; // Reset retry count on successful connection
          hasConnectedRef.current = true; // Mark that we've successfully connected
          
          // Set focus on container after connection (required for keyboard input)
          if (containerRef.current) {
            containerRef.current.focus();
            logger.log('[VNCViewer] Container focused for keyboard input');
          }
          
          // Resize after connection
          setTimeout(() => {
            if (containerRef.current) {
              const headerHeight = isFullscreen ? 0 : 48;
              const availableHeight = window.innerHeight - headerHeight;
              const availableWidth = window.innerWidth;
              containerRef.current.style.width = `${availableWidth}px`;
              containerRef.current.style.height = `${availableHeight}px`;
            }
          }, 200);
        });

        // Handle connection failures (including initial connection failures)
        // Note: disconnect event usually fires before connectfailed, so we handle reconnection in disconnect
        rfb.addEventListener('connectfailed', (e: any) => {
          const reason = e?.detail?.reason || e?.reason || 'Connection failed';
          const code = e?.detail?.code || e?.code || '';
          
          logger.error(new Error(`VNC Connection failed: ${reason || 'Unknown reason'}`), { component: 'VNCViewer', action: 'connection_failed', code, url: url.replace(/token=[^&]+/, 'token=***') });
          
          // 403 Forbidden 오류 처리
          if (reason?.includes('403') || reason?.includes('Forbidden') || code === '403') {
            logger.error(new Error('403 Forbidden - Backend authentication issue'), { component: 'VNCViewer', action: 'connection_failed', code: '403', note: 'Please check backend configuration' });
            setStatus('Connection forbidden (403). Please check backend VNC endpoint configuration.');
            return; // 재시도하지 않음 (인증 문제는 재시도해도 해결되지 않음)
          }
          
          // VNC graphics not found 에러 처리
          if (reason?.includes('VNC graphics not found') || reason?.includes('VNC graphics') || reason?.includes('graphics not found')) {
            logger.error(new Error('VNC graphics not found - VM configuration issue'), { component: 'VNCViewer', action: 'connection_failed', reason: 'vnc_graphics_not_found' });
            setStatus('VNC Connection Failed: VNC graphics not configured for this VM. Please ensure the VM has VNC graphics enabled in its configuration.');
            handleError(new Error(`VNC Connection Failed: VNC graphics not found`), {
              component: 'VNCViewer',
              action: 'connectfailed',
              reason,
              code: code.toString(),
              url: url.replace(/token=[^&]+/, 'token=***'),
              type: 'VM_CONFIG_ERROR',
            });
            return; // 재시도하지 않음 (VM 설정 문제는 재시도해도 해결되지 않음)
          }
          
          // Only set status if we haven't already handled it in disconnect
          // Don't attempt reconnection here - let disconnect handle it
          if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setStatus(`Connection failed: ${reason}. Maximum retry attempts exceeded.`);
          } else if (!hasConnectedRef.current) {
            // Only show initial failure message if we haven't connected yet
            setStatus(`Connection failed: ${reason}`);
          }
          
          // Track error (but not 1006 during reconnection attempts)
          if (code !== 1006 && code !== '1006') {
            handleError(new Error(`VNC Connection Failed: ${reason}`), {
              component: 'VNCViewer',
              action: 'connectfailed',
              reason,
              code: code.toString(),
              url: url.replace(/token=[^&]+/, 'token=***'),
              type: 'WEBSOCKET_ERROR',
            });
          }
        });

        rfb.addEventListener('disconnect', (e: any) => {
            const reason = e?.detail?.reason || e?.reason || 'Unknown reason';
            const code = e?.detail?.code || e?.code || '';
            
            logger.log('[VNCViewer] Disconnect event:', { 
              reason, 
              code, 
              hasConnected: hasConnectedRef.current, 
              attempts: reconnectAttemptsRef.current,
              url: url.replace(/token=[^&]+/, 'token=***')
            });
            
            // 403 Forbidden 오류 처리 (재시도하지 않음)
            if (reason?.includes('403') || reason?.includes('Forbidden') || code === '403') {
              logger.error(new Error('403 Forbidden - Backend authentication issue'), { component: 'VNCViewer', action: 'disconnect', code: '403' });
              setStatus('Connection forbidden (403). Please check backend VNC endpoint configuration.');
              return; // 재시도하지 않음
            }
            
            // VNC graphics not found 에러 처리
            if (reason?.includes('VNC graphics not found') || reason?.includes('VNC graphics') || reason?.includes('graphics not found')) {
              logger.error(new Error('VNC graphics not found - VM configuration issue'), { component: 'VNCViewer', action: 'disconnect', reason: 'vnc_graphics_not_found' });
              setStatus('Disconnected: VNC graphics not configured for this VM. Please ensure the VM has VNC graphics enabled in its configuration.');
              handleError(new Error(`VNC Disconnected: VNC graphics not found`), {
                component: 'VNCViewer',
                action: 'disconnect',
                reason,
                code: code.toString(),
                url: url.replace(/token=[^&]+/, 'token=***'),
                type: 'VM_CONFIG_ERROR',
              });
              return; // 재시도하지 않음
            }
            
            // Check if VM is running before attempting reconnect
            // Exponential backoff와 최대 재시도 횟수 적용
            const checkVMStatus = async (retryCount: number = 0): Promise<boolean> => {
              // 이전 요청 취소
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
              }
              
              // 새로운 AbortController 생성
              const abortController = new AbortController();
              abortControllerRef.current = abortController;
              
              try {
                // 타임아웃 설정 (10초)
                const timeoutId = setTimeout(() => {
                  abortController.abort();
                }, 10000);
                
                const vms = await vmAPI.list();
                clearTimeout(timeoutId);
                
                if (abortController.signal.aborted) {
                  return false; // 요청이 취소됨
                }
                
                const vm = vms.find(v => v.uuid === uuid);
                logger.log('[VNCViewer] VM status check:', { found: !!vm, status: vm?.status });
                
                if (!vm) {
                  setStatus('VM not found');
                  return false;
                }
                
                if (vm.status !== 'Running') {
                  setStatus(`VM is not running. Current status: ${vm.status}. Please start the VM first.`);
                  return false;
                }
                
                vmStatusCheckAttemptsRef.current = 0; // 성공 시 재시도 카운터 리셋
                return true;
              } catch (err: any) {
                // AbortController로 취소된 경우
                if (err?.name === 'AbortError' || abortController.signal.aborted) {
                  logger.warn('[VNCViewer] VM status check aborted');
                  return false;
                }
                
                // NetworkError는 네트워크 문제이므로 재시도
                const isNetworkError = err?.name === 'TypeError' && err?.message?.includes('NetworkError');
                
                if (isNetworkError && retryCount < MAX_VM_STATUS_CHECK_ATTEMPTS) {
                  // Exponential backoff: 1s, 2s, 4s
                  const delay = Math.pow(2, retryCount) * 1000;
                  logger.warn(`[VNCViewer] NetworkError during VM status check, retrying in ${delay}ms (${retryCount + 1}/${MAX_VM_STATUS_CHECK_ATTEMPTS})...`);
                  
                  await new Promise(resolve => setTimeout(resolve, delay));
                  
                  // 재시도
                  return checkVMStatus(retryCount + 1);
                }
                
                // 최대 재시도 횟수 초과 또는 다른 에러
                if (isNetworkError) {
                  logger.warn('[VNCViewer] NetworkError during VM status check after max retries, stopping reconnect attempts');
                  setStatus('Network error: Unable to verify VM status. Please check your connection and refresh the page.');
                  return false; // 재시도 중단
                }
                
                logger.error(err instanceof Error ? err : new Error(String(err)), { component: 'VNCViewer', action: 'check_vm_status_reconnect' });
                // If we can't check status (non-network error), assume VM is running and try to reconnect
                return true;
              } finally {
                if (!abortController.signal.aborted) {
                  abortControllerRef.current = null;
                }
              }
            };
            
            // 1006 error = abnormal closure, usually means connection failed
            // Only attempt reconnection if:
            // 1. We haven't exceeded max attempts
            // 2. VM is running (we'll check this)
            // 3. We have a container to reconnect to
            if ((code === 1006 || code === '1006') && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttemptsRef.current++;
              logger.warn(`[VNCViewer] Connection closed (1006), attempting reconnect ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}...`);
              setStatus(`Connection failed. Reconnecting... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
              
              // Check VM status before reconnecting
              checkVMStatus().then((shouldReconnect) => {
                if (!shouldReconnect) {
                  reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
                  return;
                }
                
                // Retry after 3 seconds - URL 다시 가져오기
                setTimeout(async () => {
                  if (containerRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    logger.log('[VNCViewer] Attempting reconnect...');
                    try {
                      if (rfbRef.current && typeof rfbRef.current.disconnect === 'function') {
                        rfbRef.current.disconnect();
                      }
                    } catch (e) {
                      // ignore
                    }
                    rfbRef.current = null;
                    // 재연결 시 URL 다시 가져오기
                    const reconnectUrl = await setupVNCConnection();
                    connect(reconnectUrl);
                  }
                }, 3000);
              }).catch((err) => {
                // checkVMStatus에서 에러가 발생한 경우 (이미 내부에서 처리되지만 안전장치)
                logger.error(err instanceof Error ? err : new Error(String(err)), { component: 'VNCViewer', action: 'check_vm_status_promise' });
                if (err?.name === 'TypeError' && err?.message?.includes('NetworkError')) {
                  setStatus('Network error: Unable to verify VM status. Please check your connection and refresh the page.');
                  reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // 재시도 중단
                }
              });
              return;
            } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
              setStatus('Reconnect failed: Maximum retry attempts exceeded. Please check VM and VNC server status.');
              return;
            }
            
            // Don't track 1006 errors as they're expected during reconnection attempts
            if (code !== 1006 && code !== '1006') {
              const message = code ? `Disconnected (code: ${code}): ${reason}` : `Disconnected: ${reason}`;
              setStatus(message);
              const error = new Error(`VNC Disconnected: ${message}`);
              handleError(error, {
                component: 'VNCViewer',
                action: 'disconnect',
                reason,
                code: code.toString(),
                url: url.replace(/token=[^&]+/, 'token=***'),
                type: 'WEBSOCKET_ERROR',
              });
            } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
              // For 1006 but max retries exceeded, show message
              setStatus(`Connection failed (code: 1006). Please check if VNC server is running on the VM.`);
            }
        });
        
        rfb.addEventListener('securityfailure', (e: any) => {
            setStatus('Security Failure');
            const error = new Error('VNC Security Failure');
            handleError(error, {
              component: 'VNCViewer',
              action: 'security_failure',
              url: url.replace(/token=[^&]+/, 'token=***'),
              type: 'WEBSOCKET_ERROR',
            });
        });

        rfb.addEventListener('credentialsrequired', () => {
            setStatus('Credentials Required');
        });

        // Add error handler
        rfb.addEventListener('error', (e: any) => {
            const errorMsg = e?.detail?.message || 'Connection error';
            logger.error(new Error(`RFB Error: ${errorMsg}`), { component: 'VNCViewer', action: 'rfb_error', detail: errorMsg });
            setStatus(`Error: ${errorMsg}`);
            const error = new Error(`VNC Error: ${errorMsg}`);
            handleError(error, {
              component: 'VNCViewer',
              action: 'vnc_error',
              detail: errorMsg,
              url: url.replace(/token=[^&]+/, 'token=***'),
              type: 'WEBSOCKET_ERROR',
            });
        });
        
        rfbRef.current = rfb;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('VNC load error');
        handleError(error, {
          component: 'VNCViewer',
          action: 'load_error',
          vmUuid: uuid,
        });
        setStatus('Error loading VNC');
      }
    };

    // URL 설정 후 VM 상태 확인 및 연결
    setupVNCConnection().then(url => {
      checkVMAndConnect(url);
    }).catch(error => {
      logger.error(error instanceof Error ? error : new Error(String(error)), { component: 'VNCViewer', action: 'setup_vnc_connection' });
      setStatus('Error: Failed to setup VNC connection');
    });

    return () => {
      // Cleanup: 진행 중인 VM 상태 확인 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Cleanup resize listener
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      
      if (rfbRef.current) {
        try {
          // Cleanup resize listener from RFB
          const rfb = rfbRef.current;
          if (rfb && (rfb as any)._resizeCleanup) {
            (rfb as any)._resizeCleanup();
          }
          // Cleanup click listener
          if (rfb && (rfb as any)._clickCleanup) {
            (rfb as any)._clickCleanup();
          }
          if (rfb && typeof rfb.disconnect === 'function') {
            rfb.disconnect();
          }
        } catch (e) {
          // ignore
        }
        rfbRef.current = null;
      }
    };
  }, [uuid, handleResize, isFullscreen]);

  // 외부 클릭 시 미디어 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMediaMenu && !(event.target as Element).closest('.media-menu-container')) {
        setShowMediaMenu(false);
      }
    };
    if (showMediaMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMediaMenu]);

  return (
    <div 
      ref={viewerRef}
      className="flex flex-col h-screen w-screen bg-black overflow-hidden" 
      style={{ 
        height: '100vh', 
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      {!isFullscreen && (
        <div 
          className="bg-gray-900 dark:bg-gray-950 border-b border-gray-700 dark:border-gray-800 flex justify-between items-center shrink-0 z-10 transition-colors px-4 py-2" 
          style={{ 
            minHeight: '56px',
            position: 'relative',
            zIndex: 10
          }}
        >
          <div className="flex items-center gap-4">
            <a 
              href="/"
              className="px-3 py-1.5 bg-gray-800 dark:bg-gray-800 border border-gray-700 dark:border-gray-700 rounded-md hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-200 dark:text-gray-200 no-underline transition-colors text-sm font-medium"
            >
              ← Back
            </a>
            <span className="text-gray-400 dark:text-gray-400 text-sm font-mono">Status: {status}</span>
          </div>
          <div className="flex items-center gap-2 relative">
            {/* Restart Button */}
            <button
              onClick={handleRestart}
              disabled={isProcessing}
              className="p-2 bg-gray-800 dark:bg-gray-800 border border-gray-700 dark:border-gray-700 rounded-md hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-300 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Restart VM (Media state preserved)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            {/* Media Management Dropdown */}
            <div className="relative media-menu-container">
              <button
                onClick={() => setShowMediaMenu(!showMediaMenu)}
                disabled={isProcessing}
                className="p-2 bg-gray-800 dark:bg-gray-800 border border-gray-700 dark:border-gray-700 rounded-md hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-300 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Media Management"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </button>
              
              {/* Media Management Menu */}
              {showMediaMenu && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 dark:bg-gray-800 border border-gray-700 dark:border-gray-700 rounded-lg shadow-xl z-30 media-menu-container">
                  <div className="p-3 border-b border-gray-700 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-200 dark:text-gray-200">Media Management</h3>
                  </div>
                  
                  {/* Mounted Media List */}
                  <div className="max-h-64 overflow-y-auto">
                    {mountedMedia.length > 0 ? (
                      <div className="p-2">
                        {mountedMedia.map((media, index) => (
                          <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-700 dark:hover:bg-gray-700 rounded mb-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-300 dark:text-gray-300 truncate" title={media.source}>
                                  {media.source}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-500">
                                  {media.target} ({media.type})
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                await handleDetachMedia();
                                // Don't close menu immediately, let user see the result
                                setTimeout(() => {
                                  setShowMediaMenu(false);
                                }, 500);
                              }}
                              disabled={isProcessing}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                              title="Disable (can be reattached later)"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-500">
                        No media mounted
                      </div>
                    )}
                  </div>
                  
                  <div className="p-2 border-t border-gray-700 dark:border-gray-700 flex gap-2">
                    <button
                      onClick={() => {
                        setShowMountDialog(true);
                        setShowMediaMenu(false);
                        // Reload ISO list when opening dialog
                        loadAvailableISOs();
                      }}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Attach
                    </button>
                    <button
                      onClick={() => {
                        loadMountedMedia();
                        loadAvailableISOs();
                      }}
                      disabled={isProcessing || isLoadingISOs}
                      className="px-3 py-2 bg-gray-700 dark:bg-gray-700 hover:bg-gray-600 dark:hover:bg-gray-600 text-gray-200 dark:text-gray-200 rounded-md text-sm transition-colors disabled:opacity-50"
                      title="Refresh"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <span className="text-gray-500 dark:text-gray-500 shrink-0 font-mono text-xs px-2">{uuid.substring(0, 8)}...</span>
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-gray-800 dark:bg-gray-800 border border-gray-700 dark:border-gray-700 rounded-md hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-300 dark:text-gray-300 transition-colors"
              title="Fullscreen (F11)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
          
          {/* Media Mount Dialog */}
          {showMountDialog && (
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50" onClick={(e) => {
              if (e.target === e.currentTarget) setShowMountDialog(false);
            }}>
              <div className="bg-gray-800 dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 border border-gray-700 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-gray-200 dark:text-gray-200">Attach ISO/CDROM Media</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300 dark:text-gray-300">
                      Select ISO File
                    </label>
                    {isLoadingISOs ? (
                      <div className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-400 dark:text-gray-400 text-sm">
                        Loading ISO list...
                      </div>
                    ) : availableISOs.length > 0 ? (
                      <select
                        value={isoPath}
                        onChange={(e) => setIsoPath(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-md text-gray-200 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setShowMountDialog(false);
                          }
                        }}
                        autoFocus
                      >
                        <option value="">-- Select ISO --</option>
                        {availableISOs.map((iso, index) => (
                          <option key={index} value={iso.path}>
                            {iso.name} ({(iso.size / 1024 / 1024 / 1024).toFixed(2)} GB)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={isoPath}
                          onChange={(e) => setIsoPath(e.target.value)}
                          placeholder="/path/to/iso/file.iso"
                          className="w-full px-3 py-2 border border-gray-600 dark:border-gray-600 rounded-md text-gray-200 dark:text-gray-200 bg-gray-700 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAttachMedia();
                            } else if (e.key === 'Escape') {
                              setShowMountDialog(false);
                            }
                          }}
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          No ISO files found. Enter path manually.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowMountDialog(false);
                        setIsoPath('');
                      }}
                      className="px-4 py-2 text-gray-300 dark:text-gray-300 bg-gray-700 dark:bg-gray-700 rounded-md hover:bg-gray-600 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAttachMedia}
                      disabled={isProcessing || !isoPath.trim()}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isProcessing ? 'Attaching...' : 'Attach'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {isFullscreen && (
        <div 
          className="absolute top-0 right-0 z-50 p-2 flex gap-2"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            zIndex: 50
          }}
        >
          <button
            onClick={handleRestart}
            disabled={isProcessing}
            className="p-2 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-md hover:bg-gray-800 text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Restart VM"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <div className="relative media-menu-container">
            <button
              onClick={() => setShowMediaMenu(!showMediaMenu)}
              disabled={isProcessing}
              className="p-2 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-md hover:bg-gray-800 text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Media Management"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </button>
            {showMediaMenu && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 dark:bg-gray-800 border border-gray-700 dark:border-gray-700 rounded-lg shadow-xl z-30 media-menu-container">
                <div className="p-3 border-b border-gray-700 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-200 dark:text-gray-200">Media Management</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {mountedMedia.length > 0 ? (
                    <div className="p-2">
                      {mountedMedia.map((media, index) => (
                        <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-700 dark:hover:bg-gray-700 rounded mb-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-300 dark:text-gray-300 truncate" title={media.source}>
                                {media.source}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                {media.target} ({media.type})
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              await handleDetachMedia();
                              // Don't close menu immediately, let user see the result
                              setTimeout(() => {
                                setShowMediaMenu(false);
                              }, 500);
                            }}
                            disabled={isProcessing}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                            title="Detach"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-500">
                        No media mounted
                      </div>
                    )}
                </div>
                <div className="p-2 border-t border-gray-700 dark:border-gray-700 flex gap-2">
                  <button
                    onClick={() => {
                      setShowMountDialog(true);
                      setShowMediaMenu(false);
                    }}
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Attach
                  </button>
                  <button
                    onClick={() => {
                      loadMountedMedia();
                      loadAvailableISOs();
                    }}
                    disabled={isProcessing || isLoadingISOs}
                    className="px-3 py-2 bg-gray-700 dark:bg-gray-700 hover:bg-gray-600 dark:hover:bg-gray-600 text-gray-200 dark:text-gray-200 rounded-md text-sm transition-colors disabled:opacity-50"
                    title="Refresh"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-md hover:bg-gray-800 text-gray-300 transition-colors"
            title="Exit Fullscreen (ESC)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <div 
        ref={containerRef} 
        className="flex-1 w-full relative overflow-hidden bg-black"
        style={{ 
          height: isFullscreen ? '100vh' : 'calc(100vh - 48px)',
          width: '100vw',
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          backgroundColor: '#000000'
        }}
      />
    </div>
  );
}