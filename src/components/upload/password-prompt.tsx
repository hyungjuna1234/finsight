"use client";

import { useState, type FormEvent } from "react";
import { ERROR_MESSAGES } from "@/lib/domain/errors";

export function PasswordPrompt({ wrong, onSubmit }: { wrong: boolean; onSubmit(password: string): void }) {
  const [password, setPassword] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (!password) return; onSubmit(password); setPassword(""); }
  return <form onSubmit={submit} className="space-y-3">
    <p className="text-sm leading-relaxed text-body">암호가 걸린 PDF예요. 카드사가 명세서와 함께 알려 준 PDF 비밀번호를 입력해 주세요. 비밀번호는 파일을 여는 데만 쓰고 저장하지 않아요.</p>
    <label className="block text-sm font-medium text-ink">PDF 비밀번호
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="off" maxLength={128} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink" />
    </label>
    {wrong ? <p role="alert" className="text-sm text-warning">{ERROR_MESSAGES.PDF_PASSWORD_WRONG}</p> : null}
    <button type="submit" disabled={!password} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:bg-disabled">열기</button>
  </form>;
}
