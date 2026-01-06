'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BootOrder, VM } from '../lib/types';

interface BootOrderSelectorProps {
  vm: VM;
  onBootOrderChange?: (uuid: string, bootOrder: BootOrder) => void;
  disabled?: boolean;
}

const bootOrderOptions: { value: BootOrder; label: string; description: string }[] = [
  {
    value: 'cdrom_hd',
    label: 'CDROM → HDD',
    description: 'CDROM 우선, HDD 다음 (설치용)',
  },
  {
    value: 'hd',
    label: 'HDD만',
    description: '디스크로만 부팅 (일반 사용)',
  },
  {
    value: 'cdrom',
    label: 'CDROM만',
    description: 'ISO로만 부팅',
  },
  {
    value: 'hd_cdrom',
    label: 'HDD → CDROM',
    description: 'HDD 우선, CDROM 다음 (복구용)',
  },
];

export default function BootOrderSelector({ vm, onBootOrderChange, disabled = false }: BootOrderSelectorProps) {
  const [selectedBootOrder, setSelectedBootOrder] = useState<BootOrder>(vm.boot_order || 'cdrom_hd');
  const [isChanging, setIsChanging] = useState(false);
  const queryClient = useQueryClient();

  const handleChange = async (newBootOrder: BootOrder) => {
    if (disabled || isChanging || newBootOrder === selectedBootOrder) return;

    setIsChanging(true);
    try {
      const response = await fetch(`/api/vms/${vm.uuid}/boot-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ boot_order: newBootOrder }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '부팅 순서 변경 실패');
      }

      const updatedVM = await response.json();
      setSelectedBootOrder(newBootOrder);
      
      // Invalidate VM queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['vms'] });
      
      if (onBootOrderChange) {
        onBootOrderChange(vm.uuid, newBootOrder);
      }

      // 성공 메시지 (선택사항)
      if (typeof window !== 'undefined' && (window as any).toast) {
        (window as any).toast.success('부팅 순서가 변경되었습니다');
      }
    } catch (error) {
      console.error('Failed to change boot order:', error);
      if (typeof window !== 'undefined' && (window as any).toast) {
        (window as any).toast.error(error instanceof Error ? error.message : '부팅 순서 변경 실패');
      }
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        부팅 순서
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {bootOrderOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleChange(option.value)}
            disabled={disabled || isChanging}
            className={`
              relative p-3 rounded-lg border-2 transition-all text-left
              ${
                selectedBootOrder === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 text-gray-900 dark:text-gray-100'
              }
              ${disabled || isChanging ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {option.description}
                </div>
              </div>
              {selectedBootOrder === option.value && (
                <svg
                  className="w-5 h-5 text-blue-500 flex-shrink-0 ml-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>
      {isChanging && (
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          부팅 순서 변경 중...
        </div>
      )}
    </div>
  );
}

