'use client';

import { useEffect } from 'react';
import { initWebVitals } from '../lib/webVitals';

export default function WebVitalsClient() {
  useEffect(() => {
    // Web Vitals 모니터링 초기화
    initWebVitals();
  }, []);

  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
}








