import type { ChatTurn } from "@/lib/domain/chat";
import { SafeMarkdown } from "@/components/ui/safe-markdown";

export function MessageList({ messages, loading }: { messages: ChatTurn[]; loading: boolean }) {
  if (messages.length === 0 && !loading) return null;
  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-md bg-accent-soft px-4 py-3 text-sm text-ink" : "border-l-2 border-line pl-4"}>
          {message.role === "user" ? <p className="whitespace-pre-wrap">{message.content}</p> : <SafeMarkdown text={message.content} />}
        </div>
      ))}
      {loading ? <p aria-live="polite" className="text-sm text-muted">답을 찾고 있어요…</p> : null}
    </div>
  );
}
