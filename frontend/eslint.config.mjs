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
];
