'use client';

import { useState, useEffect, useRef } from 'react';
import { quotaAPI, QuotaUsage } from '../lib/api';

export default function QuotaDisplay() {
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 800; // Minimum 800ms between fetches - responsive but not excessive

  const fetchQuota = async () => {
    const now = Date.now();
    // Throttle: prevent fetching if last fetch was too recent
    if (now - lastFetchRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchRef.current = now;
    
    try {
      const data = await quotaAPI.get();
      setQuota(data);
    } catch (err) {
      console.error('Failed to fetch quota', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
    
    // Listen for VM change events to refresh quota (with debouncing)
    const handleVMChange = () => {
      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Debounce to prevent excessive API calls while keeping it responsive
      debounceTimerRef.current = setTimeout(() => {
        fetchQuota();
      }, 500); // 500ms debounce - good balance
    };
    
    window.addEventListener('vmChanged', handleVMChange);
    
    // Fallback: poll every 20 seconds - good balance for manual refresh
    const interval = setInterval(fetchQuota, 20000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('vmChanged', handleVMChange);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (loading || !quota) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Resource Quota</h2>
        <div className="text-center text-gray-500 py-4">Loading...</div>
      </div>
    );
  }

  const vmPercent = (quota.usage.vms / quota.quota.max_vms) * 100;
  const cpuPercent = (quota.usage.cpu / quota.quota.max_cpu) * 100;
  const memoryPercent = (quota.usage.memory / quota.quota.max_memory) * 100;

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${
          vmPercent >= 90 || cpuPercent >= 90 || memoryPercent >= 90 ? 'bg-red-500' : 
          vmPercent >= 70 || cpuPercent >= 70 || memoryPercent >= 70 ? 'bg-yellow-500' : 
          'bg-green-500'
        }`}></span>
        Resource Quota
      </h2>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center p-2 bg-gray-100 rounded mb-2">
            <span className="font-medium text-sm">VMs</span>
            <span className="text-sm font-mono">{quota.usage.vms} / {quota.quota.max_vms}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                vmPercent >= 90 ? 'bg-red-500' : vmPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(vmPercent, 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center p-2 bg-gray-100 rounded mb-2">
            <span className="font-medium text-sm">CPU Cores</span>
            <span className="text-sm font-mono">{quota.usage.cpu} / {quota.quota.max_cpu}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                cpuPercent >= 90 ? 'bg-red-500' : cpuPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(cpuPercent, 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center p-2 bg-gray-100 rounded mb-2">
            <span className="font-medium text-sm">Memory</span>
            <span className="text-sm font-mono">{(quota.usage.memory / 1024).toFixed(1)} / {(quota.quota.max_memory / 1024).toFixed(1)} GB</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                memoryPercent >= 90 ? 'bg-red-500' : memoryPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(memoryPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

