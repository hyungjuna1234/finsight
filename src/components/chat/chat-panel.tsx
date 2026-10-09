"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch, redirectPathForError } from "@/components/ui/api-fetch";
import { AiDisclaimer } from "@/components/ui/ai-disclaimer";
import { CHAT_LIMITS, normalizeHistory, type ChatTurn } from "@/lib/domain/chat";
import { ChatInput } from "./chat-input";
import { chatStorageKey, pruneChatStorage } from "./chat-storage";
import { ExampleQuestions } from "./example-questions";
import { MessageList } from "./message-list";

function storedMessages(value: string | null): ChatTurn[] | null {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => item !== null && typeof item === "object" && ((item as ChatTurn).role === "user" || (item as ChatTurn).role === "assistant") && typeof (item as ChatTurn).content === "string" && (item as ChatTurn).content.length <= ((item as ChatTurn).role === "user" ? CHAT_LIMITS.messageMax : CHAT_LIMITS.assistantMax))) return null;
    return parsed as ChatTurn[];
  } catch { return null; }
}

export function ChatPanel({ ownerId, examples }: { ownerId: string; examples: readonly string[] }) {
  const storageKey = chatStorageKey(ownerId);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ question: string; history: ChatTurn[] } | null>(null);

  useEffect(() => {
    pruneChatStorage(ownerId);
    const restored = storedMessages(sessionStorage.getItem(storageKey));
    if (restored === null) sessionStorage.removeItem(storageKey);
    // sessionStorage is unavailable during server rendering, so restoration belongs to this client sync effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setMessages(restored);
    setReady(true);
  }, [ownerId, storageKey]);
  useEffect(() => {
    if (!ready) return;
    if (messages.length === 0) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, ready, storageKey]);

  const request = async (question: string, history: ChatTurn[], appendUser: boolean) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || loading) return;
    if (appendUser) setMessages((current) => [...current, { role: "user", content: cleanQuestion }]);
    setInput(""); setLoading(true); setError(null); setRetry(null);
    try {
      const response = await apiFetch<{ text: string }>("/api/chat", { method: "POST", body: { history: normalizeHistory(history), message: cleanQuestion } });
      setMessages((current) => [...current, { role: "assistant", content: response.text }]);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const path = redirectPathForError(caught.code, "/chat");
        if (path) { window.location.assign(path); return; }
        if (caught.code === "RATE_LIMITED") setError("오늘 질문 한도를 다 썼어요. 내일 다시 시도해 주세요.");
        else if (caught.code === "AI_UNAVAILABLE" || caught.code === "NETWORK") { setError("답을 만들지 못했어요."); setRetry({ question: cleanQuestion, history }); }
        else setError(caught.message);
      } else { setError("답을 만들지 못했어요."); setRetry({ question: cleanQuestion, history }); }
    } finally { setLoading(false); }
  };
  const submit = (question = input) => void request(question, messages, true);
  const clear = () => { setMessages([]); setError(null); setRetry(null); sessionStorage.removeItem(storageKey); };

  return (
    <section className="space-y-6">
      {messages.length === 0 && !loading ? <ExampleQuestions examples={examples} onPick={submit} disabled={loading} /> : <MessageList messages={messages} loading={loading} />}
      {messages.length === 0 && loading ? <MessageList messages={messages} loading /> : null}
      {error ? <p role="alert" className="text-sm text-warning">{error}{retry ? <> <button type="button" onClick={() => void request(retry.question, retry.history, false)} className="underline underline-offset-4">다시 시도</button></> : null}</p> : null}
      <ChatInput value={input} onChange={setInput} onSubmit={() => submit()} disabled={loading} />
      {messages.length > 0 ? <button type="button" onClick={clear} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">대화 지우기</button> : null}
      <div><AiDisclaimer /><p className="mt-1 text-sm text-muted">대화는 이 탭에만 잠시 보관되고 서버에 저장되지 않아요.</p></div>
    </section>
  );
}
