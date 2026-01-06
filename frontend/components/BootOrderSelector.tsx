'use client';

import { useState, useEffect } from 'react';
import type { BootOrder } from '../lib/types';

interface BootOrderSelectorProps {
  value: BootOrder | undefined;
  onChange: (bootOrder: BootOrder) => void;
  disabled?: boolean;
}

const bootOrderOptions: { value: BootOrder; label: string; description: string }[] = [
  { value: 'cdrom-hdd', label: 'CDROM → HDD', description: 'CDROM을 먼저 시도하고, 실패 시 HDD 부팅' },
  { value: 'hdd-only', label: 'HDD만', description: 'HDD만 부팅 (일반 운영 모드)' },
  { value: 'cdrom-only', label: 'CDROM만', description: 'CDROM만 부팅 (설치 모드)' },
  { value: 'hdd-cdrom', label: 'HDD → CDROM', description: 'HDD를 먼저 시도하고, 실패 시 CDROM 부팅' },
];

export default function BootOrderSelector({ value, onChange, disabled = false }: BootOrderSelectorProps) {
  const [selectedValue, setSelectedValue] = useState<BootOrder>(value || 'hdd-only');

  // value prop이 변경되면 상태 업데이트 (값이 없어도 업데이트)
  useEffect(() => {
    if (value !== undefined && value !== null) {
      console.log('[BootOrderSelector] Value prop changed:', { from: selectedValue, to: value });
      setSelectedValue(value);
    } else if (value === undefined || value === null) {
      // 값이 없으면 기본값으로 설정
      setSelectedValue('hdd-only');
    }
  }, [value]);

  const handleChange = (newValue: BootOrder) => {
    if (disabled) return;
    console.log('[BootOrderSelector] Changing boot order:', { from: selectedValue, to: newValue });
    setSelectedValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        부팅 순서
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {bootOrderOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleChange(option.value)}
            disabled={disabled}
            className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
              selectedValue === option.value
                ? 'border-cyan-600 bg-cyan-50 text-cyan-900'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-pressed={selectedValue === option.value}
          >
            <div className="font-medium text-sm">{option.label}</div>
            <div className="text-xs text-gray-500 mt-1">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

