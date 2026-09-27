import { runCleanup } from "@/server/actions/cleanup";
import { handler } from "@/server/handler";

export const maxDuration = 60;

// Vercel Cron은 GET만 보내므로, Bearer 비밀로 보호한 이 라우트만 GET 부작용을 허용한다.
export const GET = handler({ auth: "cron" }, async () => ({
  removed: await runCleanup(new Date()),
}));
