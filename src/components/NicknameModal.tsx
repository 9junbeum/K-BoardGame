"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  defaultValue?: string;
  title?: string;
  onSubmit: (nickname: string) => void;
}

export default function NicknameModal({ open, defaultValue = "", title, onSubmit }: Props) {
  const [value, setValue] = useState(defaultValue);

  if (!open) return null;

  const submit = () => {
    const v = value.trim();
    if (v.length === 0) return;
    onSubmit(v.slice(0, 12));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="banner-in w-full max-w-sm rounded-lg border border-mud/30 bg-paper p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{title ?? "닉네임을 입력하세요"}</h2>
        <p className="mt-1 font-plex text-xs text-mud">가입 없이 닉네임만으로 시작합니다.</p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={12}
          placeholder="예: 바둑알장인"
          className="mt-4 w-full rounded border border-mud/40 bg-white/60 px-3 py-2 text-ink outline-none focus:border-vermil"
        />
        <button
          onClick={submit}
          disabled={value.trim().length === 0}
          className="mt-4 w-full rounded bg-ink px-4 py-2.5 text-paper transition hover:bg-ink-soft disabled:opacity-40"
        >
          입장하기
        </button>
      </div>
    </div>
  );
}
