import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 레이어 규칙 (CLAUDE.md 규칙 1, docs/ARCHITECTURE.md)
// - lib/**        : 순수 함수. next·react·supabase·server·services·components import 금지
// - components/** : props만 받는다. supabase·server·services import 금지
// - 그 외 src/**  : Supabase SDK는 services/supabase에서만, admin client는 server/admin.ts에서만
const SUPABASE_SDK = { group: ["@supabase/*"], message: "Supabase SDK는 src/services/supabase/에서만 import합니다." };
const ADMIN_CLIENT = {
  group: ["**/services/supabase/admin", "**/services/supabase/admin.*"],
  message: "admin client는 src/server/admin.ts에서만 씁니다.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"]),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/services/supabase/**", "src/lib/**", "src/components/**", "src/server/admin.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [SUPABASE_SDK, ADMIN_CLIENT] }],
    },
  },
  {
    files: ["src/server/admin.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [SUPABASE_SDK] }],
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "react-dom",
                "@supabase/*",
                "@/server/*",
                "@/services/*",
                "@/components/*",
                "@/app/*",
                "**/server/**",
                "**/services/**",
                "**/components/**",
              ],
              message: "lib/에는 순수 함수만 둡니다. 프레임워크·DB·외부 서비스에 의존하지 마세요.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@/server/*", "@/services/*", "**/server/**", "**/services/**"],
              message: "컴포넌트는 props만 받습니다. 데이터는 page.tsx에서 server/queries로 읽어 넘기세요.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
