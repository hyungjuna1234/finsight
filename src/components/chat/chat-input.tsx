import type { ChangeEvent, KeyboardEvent } from "react";
import { CHAT_LIMITS } from "@/lib/domain/chat";

export function ChatInput({ value, onChange, onSubmit, disabled }: { value: string; onChange: (value: string) => void; onSubmit: () => void; disabled: boolean }) {
  const cannotSubmit = disabled || value.trim().length === 0;
  const change = (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value.slice(0, CHAT_LIMITS.messageMax));
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || cannotSubmit) return;
    event.preventDefault();
    onSubmit();
  };
  return (
    <div className="space-y-2">
      <textarea aria-label="질문" rows={3} maxLength={CHAT_LIMITS.messageMax} value={value} disabled={disabled} onChange={change} onKeyDown={keyDown} className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:text-disabled" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-muted">{value.length}/{CHAT_LIMITS.messageMax}</span>
        <button type="button" disabled={cannotSubmit} onClick={onSubmit} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:bg-disabled">보내기</button>
      </div>
    </div>
  );
}
