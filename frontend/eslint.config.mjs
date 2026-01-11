// frontend/eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

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
    ],
  },
  // 프로덕션 소스: 강한 규칙 유지
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
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
