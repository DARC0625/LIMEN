'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export default function VNCViewer({ id }: { id: string }) {
  const rfbRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting...');
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastResizeTimeRef = useRef<number>(0);

  // Throttled resize handler to prevent excessive calls
  const handleResize = useCallback(() => {
    if (!containerRef.current) return;
    
    const now = Date.now();
    const timeSinceLastResize = now - lastResizeTimeRef.current;
    
    // Throttle to maximum once per 200ms
    if (timeSinceLastResize < 200) {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        handleResize();
      }, 200 - timeSinceLastResize);
      return;
    }
    
    lastResizeTimeRef.current = now;
    
    // Calculate available height (viewport height minus header)
    const headerHeight = 48;
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
  }, []);

  useEffect(() => {
    // Construct WebSocket URL
    // In production, use relative path through Envoy proxy (/vnc/{uuid})
    // In development, use direct backend connection (/ws/vnc?id={id})
    const isProduction = process.env.NODE_ENV === 'production';
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    
    let url: string;
    if (isProduction) {
      // Production: Use relative path through Envoy proxy
      // Envoy will proxy /vnc/{uuid} to backend
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      url = `${protocol}://${window.location.host}/vnc/${id}${tokenParam}`;
      if (process.env.NEXT_PUBLIC_BACKEND_URL) {
        console.warn('[VNCViewer] NEXT_PUBLIC_BACKEND_URL is set in production but will be ignored. Using relative path for Envoy proxy.');
      }
    } else {
      // Development: Connect directly to backend
      const backendHost = process.env.NEXT_PUBLIC_BACKEND_URL 
        ? process.env.NEXT_PUBLIC_BACKEND_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '')
        : 'localhost:8080';
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      url = `${protocol}://${backendHost}/ws/vnc?id=${id}${tokenParam}`;
    }

    let rfb: any;

    const connect = async () => {
      try {
        if (typeof window === 'undefined') return;

        // Dynamic import for client-side only
        // @ts-ignore
        const rfbModule = await import('@novnc/novnc/lib/rfb');
        const RFB = rfbModule.default || rfbModule;

        if (!containerRef.current) return;

        // Create RFB connection
        rfb = new RFB(containerRef.current, url, {
          credentials: { password: 'password' },
        });

        // Configure VNC scaling and sizing
        rfb.scaleViewport = true; // Scale to fit container
        rfb.resizeSession = false; // Disable server resize to prevent issues
        rfb.background = 'black';
        
        // Initial resize with a small delay to ensure DOM is ready
        setTimeout(() => {
          if (containerRef.current) {
            const headerHeight = 48;
            const availableHeight = window.innerHeight - headerHeight;
            const availableWidth = window.innerWidth;
            containerRef.current.style.width = `${availableWidth}px`;
            containerRef.current.style.height = `${availableHeight}px`;
          }
        }, 100);
        
        // Listen for window resize with throttled handler
        window.addEventListener('resize', handleResize);
        
        // Cleanup resize listener
        const cleanupResize = () => {
          window.removeEventListener('resize', handleResize);
          if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = null;
          }
        };
        
        // Store cleanup function
        (rfb as any)._resizeCleanup = cleanupResize;

        rfb.addEventListener('connect', () => {
            setStatus('Connected');
            // Trigger resize after connection to ensure proper sizing (only once, no loop)
            setTimeout(() => {
              if (containerRef.current) {
                const headerHeight = 48;
                const availableHeight = window.innerHeight - headerHeight;
                const availableWidth = window.innerWidth;
                containerRef.current.style.width = `${availableWidth}px`;
                containerRef.current.style.height = `${availableHeight}px`;
              }
            }, 200);
        });

        rfb.addEventListener('disconnect', (e: any) => {
            const reason = e?.detail?.reason || e?.reason || 'Unknown reason';
            const code = e?.detail?.code || e?.code || '';
            const message = code ? `Disconnected (code: ${code}): ${reason}` : `Disconnected: ${reason}`;
            setStatus(message);
            console.error("VNC Disconnected", { reason, code, detail: e?.detail, event: e });
        });
        
        rfb.addEventListener('securityfailure', (e: any) => {
            setStatus('Security Failure');
            console.error("VNC Security Failure", e);
        });

        rfb.addEventListener('credentialsrequired', () => {
            setStatus('Credentials Required');
        });

        // Add error handler
        rfb.addEventListener('error', (e: any) => {
            const errorMsg = e?.detail?.message || 'Connection error';
            setStatus(`Error: ${errorMsg}`);
            console.error("VNC Error", e);
        });

        rfbRef.current = rfb;
      } catch (err) {
        console.error("VNC load error:", err);
        setStatus('Error loading VNC');
      }
    };

    connect();

    return () => {
      // Cleanup resize listener
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      
      if (rfbRef.current) {
        try {
          // Cleanup resize listener from RFB
          if ((rfbRef.current as any)._resizeCleanup) {
            (rfbRef.current as any)._resizeCleanup();
          }
          rfbRef.current.disconnect();
        } catch (e) {
          // ignore
        }
        rfbRef.current = null;
      }
    };
  }, [id, handleResize]);

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden" style={{ height: '100vh', width: '100vw' }}>
      <div className="bg-gray-100 p-2 text-sm font-mono border-b flex justify-between items-center shrink-0 z-10" style={{ minHeight: '48px' }}>
        <div className="flex items-center gap-4">
          <a 
            href="/"
            className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-black no-underline"
          >
            ← Back
          </a>
          <span className="text-gray-700">Status: {status}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-700 shrink-0">VM #{id}</span>
        </div>
      </div>
      <div 
        ref={containerRef} 
        className="flex-1 w-full relative overflow-hidden"
        style={{ 
          height: 'calc(100vh - 48px)',
          width: '100vw'
        }}
      />
    </div>
  );
}
