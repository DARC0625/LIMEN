import { useEffect, useRef } from 'react';
import { VM } from '../lib/api';

interface WebSocketMessage {
  type: 'vm_update' | 'vm_list';
  vm?: VM;
  vms?: VM[];
}

export function useVMWebSocket(
  onVMUpdate: (vm: VM) => void,
  onVMList: (vms: VM[]) => void,
  enabled: boolean = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  
  // Use refs to avoid reconnecting on callback changes
  const onVMUpdateRef = useRef(onVMUpdate);
  const onVMListRef = useRef(onVMList);
  
  // Update refs when callbacks change
  useEffect(() => {
    onVMUpdateRef.current = onVMUpdate;
    onVMListRef.current = onVMList;
  }, [onVMUpdate, onVMList]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const connect = () => {
      try {
        // Get token from localStorage
        const token = localStorage.getItem('auth_token');
        if (!token) {
          return;
        }

        // Determine WebSocket URL
        // Next.js rewrites don't support WebSocket upgrades, so connect directly to backend
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const backendHost = process.env.NEXT_PUBLIC_BACKEND_URL 
          ? process.env.NEXT_PUBLIC_BACKEND_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '')
          : (process.env.NEXT_PUBLIC_API_URL 
              ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/api$/, '')
              : 'localhost:8080');
        const wsUrl = `${protocol}://${backendHost}/ws/vm-status?token=${encodeURIComponent(token)}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            if (message.type === 'vm_update' && message.vm) {
              onVMUpdateRef.current(message.vm);
            } else if (message.type === 'vm_list' && message.vms) {
              onVMListRef.current(message.vms);
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message', err);
          }
        };

        ws.onerror = (error) => {
          // WebSocket error event doesn't provide detailed error info
          // Log connection attempt info instead
          console.warn('VM WebSocket connection error. Will attempt to reconnect...', {
            url: wsUrl.replace(/token=[^&]+/, 'token=***'),
            readyState: ws.readyState
          });
        };

        ws.onclose = (event) => {
          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectDelay);
          }
        };
      } catch (err) {
        console.error('Failed to create VM WebSocket connection', err);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [enabled]); // Only depend on enabled, not callbacks
}

