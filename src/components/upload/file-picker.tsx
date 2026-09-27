"use client";

import { useState, type ChangeEvent } from "react";
import { ERROR_MESSAGES } from "@/lib/domain/errors";
import { ACCEPT_ATTR, checkUploadFile } from "@/lib/domain/upload";

export function FilePicker({ onFiles, disabled }: { onFiles(files: File[]): void; disabled: boolean }) {
  const [errors, setErrors] = useState<string[]>([]);
  function change(event: ChangeEvent<HTMLInputElement>) {
    const accepted: File[] = []; const rejected: string[] = [];
    for (const file of Array.from(event.target.files ?? [])) {
      const code = checkUploadFile(file);
      if (code) rejected.push(`${file.name}: ${ERROR_MESSAGES[code]}`); else accepted.push(file);
    }
    setErrors(rejected); if (accepted.length) onFiles(accepted); event.target.value = "";
  }
  return <div className="space-y-2">
    <label className="block text-sm font-medium text-ink" htmlFor="statement-files">카드 이용내역 파일 선택</label>
    <input id="statement-files" type="file" multiple accept={ACCEPT_ATTR} disabled={disabled} onChange={change} className="block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-body file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white disabled:text-disabled" />
    {errors.map((error) => <p key={error} role="alert" className="text-sm text-warning">{error}</p>)}
  </div>;
}
