# VNC 뷰어 오류 해결 가이드

## 발생하는 오류들

### 1. `exports is not defined`
**원인**: CommonJS와 ESM 모듈 시스템 충돌

**해결 방법**:

#### next.config.js 수정
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 브라우저 환경에서 Node.js 모듈 제외
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
      
      // CommonJS 모듈을 ESM으로 변환
      config.module.rules.push({
        test: /\.js$/,
        include: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['next/babel'],
            plugins: [],
          },
        },
      });
    }
    
    // externals 설정으로 특정 모듈 제외
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'utf-8-validate': 'commonjs utf-8-validate',
        'bufferutil': 'commonjs bufferutil',
      });
    }
    
    return config;
  },
  
  // ESM 모듈 지원
  experimental: {
    esmExternals: true,
  },
  
  // 트랜스파일 설정
  transpilePackages: ['@novnc/noVNC', 'novnc-core'],
};
```

#### package.json 확인
```json
{
  "type": "module",  // 제거하거나 "commonjs"로 변경
  "dependencies": {
    "@novnc/noVNC": "^1.4.0",  // 최신 버전 사용
    "novnc-core": "^1.4.0"
  }
}
```

### 2. `Element.setCapture() is deprecated`
**원인**: 구식 DOM API 사용

**해결 방법**: 
- noVNC 라이브러리를 최신 버전으로 업데이트
- 또는 라이브러리 내부 코드 수정 (권장하지 않음)

```bash
npm install @novnc/noVNC@latest
# 또는
yarn add @novnc/noVNC@latest
```

### 3. `l.isWindows is not a function`
**원인**: noVNC 라이브러리의 플랫폼 감지 함수 문제

**해결 방법**:

#### 방법 1: noVNC 버전 업데이트
```bash
npm install @novnc/noVNC@latest
```

#### 방법 2: 수동 패치 (임시 해결책)
noVNC 라이브러리 파일을 직접 수정:

```javascript
// node_modules/@novnc/noVNC/core/util/browser.js 또는 유사한 파일
// isWindows 함수가 없는 경우 추가:

export function isWindows() {
  return typeof navigator !== 'undefined' && 
         /Win/i.test(navigator.platform || navigator.userAgent);
}

// 또는 CommonJS 형식:
function isWindows() {
  return typeof navigator !== 'undefined' && 
         /Win/i.test(navigator.platform || navigator.userAgent);
}
module.exports = { isWindows };
```

#### 방법 3: VNC 뷰어 컴포넌트 수정
```typescript
// VNCViewer.tsx 또는 유사한 파일
import RFB from '@novnc/noVNC/core/rfb';

// isWindows 함수가 없는 경우 직접 구현
const isWindows = () => {
  return typeof navigator !== 'undefined' && 
         /Win/i.test(navigator.platform || navigator.userAgent);
};

// RFB 인스턴스 생성 전에 전역으로 설정
if (typeof window !== 'undefined') {
  (window as any).isWindows = isWindows;
}
```

## 권장 해결 방법

### 1. noVNC 최신 버전 사용
```bash
npm uninstall @novnc/noVNC novnc-core
npm install @novnc/noVNC@latest
```

### 2. next.config.js 완전한 설정
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  webpack: (config, { isServer, webpack }) => {
    // 브라우저 환경에서 Node.js 모듈 제외
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    
    // noVNC 관련 모듈 처리
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/@novnc/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['next/babel'],
        },
      },
    });
    
    // 플러그인 추가
    config.plugins.push(
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
      })
    );
    
    return config;
  },
  
  // ESM 모듈 지원
  experimental: {
    esmExternals: true,
  },
  
  // 트랜스파일할 패키지
  transpilePackages: ['@novnc/noVNC'],
};
```

### 3. VNC 뷰어 컴포넌트 수정
```typescript
'use client';

import { useEffect, useRef } from 'react';
import RFB from '@novnc/noVNC/core/rfb';

interface VNCViewerProps {
  url: string;
  token: string;
  vmUuid: string;
}

export default function VNCViewer({ url, token, vmUuid }: VNCViewerProps) {
  const screenRef = useRef<HTMLCanvasElement>(null);
  const rfbRef = useRef<RFB | null>(null);

  useEffect(() => {
    if (!screenRef.current) return;

    // isWindows 함수가 없는 경우 추가
    if (typeof window !== 'undefined' && !(window as any).isWindows) {
      (window as any).isWindows = () => {
        return typeof navigator !== 'undefined' && 
               /Win/i.test(navigator.platform || navigator.userAgent);
      };
    }

    const rfb = new RFB(screenRef.current, url, {
      credentials: {
        password: token,
      },
    });

    rfb.addEventListener('connect', () => {
      console.log('VNC connected');
    });

    rfb.addEventListener('disconnect', (e: any) => {
      console.log('VNC disconnected:', e.detail);
    });

    rfbRef.current = rfb;

    return () => {
      if (rfbRef.current) {
        rfbRef.current.disconnect();
      }
    };
  }, [url, token]);

  return (
    <div className="vnc-container">
      <canvas ref={screenRef} className="vnc-screen" />
    </div>
  );
}
```

## 대안: 다른 VNC 라이브러리 사용

### react-vnc-display
```bash
npm install react-vnc-display
```

```typescript
import VncDisplay from 'react-vnc-display';

<VncDisplay
  url={vncUrl}
  scaleViewport
  background="#000000"
  style={{
    width: '100%',
    height: '100%',
  }}
/>
```

### @novnc/novnc (공식 패키지)
```bash
npm install @novnc/novnc
```

## 디버깅

### 1. 브라우저 콘솔 확인
- 개발자 도구 → Console 탭
- 오류 메시지와 스택 트레이스 확인

### 2. 네트워크 확인
- 개발자 도구 → Network 탭
- WebSocket 연결 확인 (`ws://` 또는 `wss://`)

### 3. 빌드 로그 확인
```bash
npm run build
# 빌드 오류 확인
```

## 관련 문서

- [noVNC 공식 문서](https://novnc.com/info.html)
- [Next.js Webpack 설정](https://nextjs.org/RAG/api-reference/next.config.js/custom-webpack-config)
- [프론트엔드 오류 해결 가이드](./FRONTEND_ERRORS.md)









