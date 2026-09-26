import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 巨型组件护栏（复杂度 ratchet）：
  // max-params / max-depth 已零违规，直接以 error 拦截新代码；
  // max-lines-per-function / complexity 的既有超限函数（AdminSettingsClient /
  // AdminPostWorkspace / runDailyAiNews 等）以 warning 列出，逐刀拆分后收紧为 error。
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-lines-per-function": ["warn", { max: 250, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", { max: 5 }],
      "max-depth": ["error", { max: 6 }],
      "complexity": ["warn", { max: 30 }],
    },
  },
  // 测试用例按场景展开，允许长回调；复杂度护栏只约束源码
  {
    files: ["src/**/*.test.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "max-lines-per-function": "off",
      "max-params": "off",
      "max-depth": "off",
      "complexity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".generated/**",
    ".worktrees/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**/*.cjs",
    // 第三方 agent skill 脚本与本地 agent 工作目录，不参与本项目质量门禁
    ".agents/**",
    ".impeccable/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
