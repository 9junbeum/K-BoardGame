import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 네이티브 앱(Capacitor) 프로젝트 — 생성/빌드 산출물이라 린트 대상 아님
    "android/**",
    "ios/**",
    "capacitor-www/**",
  ]),
]);

export default eslintConfig;
