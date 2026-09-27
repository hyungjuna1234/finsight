import { safeRedirect } from "@/lib/domain/redirect";
import type { InAppBrowser } from "@/lib/domain/user-agent";

export interface LoginPanelProps {
  next: string | null;
  error: string | null;
  inAppBrowser: InAppBrowser | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: "로그인을 취소했어요. 다시 시도해 주세요.",
  provider: "지원하지 않는 로그인 방식이에요.",
  oauth: "로그인을 시작하지 못했어요. 다시 시도해 주세요.",
  callback: "로그인을 완료하지 못했어요. 다시 시도해 주세요.",
};

const IN_APP_NAMES: Record<InAppBrowser, string> = {
  kakaotalk: "카카오톡",
  instagram: "인스타그램",
  facebook: "페이스북",
  naver: "네이버",
  line: "라인",
};

export function LoginPanel({ next, error, inAppBrowser }: LoginPanelProps) {
  const destination = safeRedirect(next);
  const queryNext = encodeURIComponent(destination);
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium text-accent">FinSight</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">카드 지출을 한눈에 정리해요</h1>
        </div>

        {errorMessage ? <p role="alert" className="rounded-md border border-line bg-surface p-3 text-sm text-body">{errorMessage}</p> : null}

        <div className="space-y-3">
          <a className="block rounded-md bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover" href={`/auth/login?provider=kakao&next=${queryNext}`}>
            카카오로 시작하기
          </a>
          {inAppBrowser ? (
            <p className="text-sm leading-relaxed text-body">
              {IN_APP_NAMES[inAppBrowser]} 안에서는 구글 로그인이 막혀 있어요. 오른쪽 위 메뉴에서 &apos;다른 브라우저로 열기&apos;를 눌러 주세요.
            </p>
          ) : null}
          <a className="block rounded-md border border-line bg-surface px-4 py-2.5 text-center text-sm font-medium text-ink hover:bg-bg" href={`/auth/login?provider=google&next=${queryNext}`}>
            구글로 시작하기
          </a>
        </div>

        <p className="text-sm leading-relaxed text-muted">연동 없이 카드 내역 파일만 받아요. 원본은 90일 후 자동 삭제돼요.</p>
      </section>
    </main>
  );
}
