// frontend/eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

// Note: next/core-web-vitals는 Next.js 16.1.1에서 FlatCompat과 호환성 문제가 있어
// 일시적으로 제외. Next.js가 flat config를 완전히 지원하면 다시 활성화 가능.
// 현재는 기본 ESLint + TypeScript 규칙만 사용.
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // ...compat.extends("next/core-web-vitals"), // TODO: Next.js flat config 지원 대기
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "public/novnc/**", // 외부 번들: ESLint로 수정하지 않음
      "public/sw.js", // Service Worker: 외부 번들 또는 자체 작성이면 override로 처리
    ],
  },
  // (A) Browser 환경 (기본): window/document/navigator 등 브라우저 글로벌 허용
  {
    files: [
      "app/**/*.{ts,tsx,js,jsx}",
      "components/**/*.{ts,tsx,js,jsx}",
      "hooks/**/*.{ts,tsx,js,jsx}",
      "lib/**/*.{ts,tsx,js,jsx}",
      "src/**/*.{ts,tsx,js,jsx}",
    ],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        PerformanceObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
      },
    },
  },
  // (B) Node 환경 (설정/스크립트)
  {
    files: [
      "next.config.js",
      "postcss.config.js",
      "tailwind.config.js",
      "scripts/**/*.js",
      "jest.config.js",
      "jest.setup.js",
      "extract-trace-payload.js",
      "ecosystem.config.js",
    ],
    languageOptions: {
      globals: {
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        console: "readonly",
        Buffer: "readonly",
        global: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },
  // (D) novnc-browser-patch.js: Node + Browser 멀티타겟 패치
  {
    files: ["lib/novnc-browser-patch.js"],
    languageOptions: {
      globals: {
        ...globals.node,     // module, exports, require, process 등
        ...globals.browser,  // window, document 등
      },
    },
    rules: {
      // 필요하면 여기서만 no-undef 완화도 가능
      // "no-undef": "off",
    },
  },
  // (C) Service Worker 환경
  {
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        URL: "readonly",
        location: "readonly",
        console: "readonly",
        ServiceWorkerRegistration: "readonly",
        ServiceWorkerGlobalScope: "readonly",
        ExtendableEvent: "readonly",
        FetchEvent: "readonly",
        InstallEvent: "readonly",
        ActivateEvent: "readonly",
        SyncEvent: "readonly",
        Cache: "readonly",
        CacheStorage: "readonly",
        Response: "readonly",
        Request: "readonly",
      },
    },
  },
  // 프로덕션 소스: 강한 규칙 유지
  {
    files: ["src/**/*.{ts,tsx,js,jsx}", "app/**/*.{ts,tsx,js,jsx}", "components/**/*.{ts,tsx,js,jsx}", "hooks/**/*.{ts,tsx,js,jsx}", "lib/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // 테스트 파일: 실용 우선 (규칙 완화)
  {
    files: ["__tests__/**/*.{ts,tsx,js,jsx}", "**/*.test.{ts,tsx,js,jsx}", "**/*.spec.{ts,tsx,js,jsx}"],
    rules: {
      // 테스트에서는 실용 우선
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
