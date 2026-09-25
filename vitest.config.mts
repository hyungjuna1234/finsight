import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 규칙: *.test.ts → node 환경(unit), *.test.tsx → jsdom 환경(dom).
// 테스트는 대상 파일과 같은 폴더에 둔다. 네트워크를 쓰지 않는다(외부 서비스는 vi.mock).
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // 'server-only'는 React 서버 번들 밖에서 import하면 throw한다. 테스트에서는 빈 모듈로 대체한다.
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "supabase/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
