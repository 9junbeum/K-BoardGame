"use client";

import { useEffect, useRef, useState } from "react";
import { type ChatMessage } from "@/lib/chat";
import { useChat } from "@/lib/useChat";
import { useIsDesktop } from "@/lib/useIsDesktop";

interface ChatWidgetProps {
  roomId: string;
  myId: string;
  /** 참가(닉네임 입력)를 마치기 전에는 채팅을 아예 보여주지 않는다 */
  nickname: string | null;
  /** 내가 메시지를 보낸 직후 호출 — 캐치마인드 정답 판정 등에 사용 */
  onSent?: (text: string) => void;
}

const DESKTOP_WIDTH = 320;

export default function ChatWidget({ roomId, myId, nickname, onSent }: ChatWidgetProps) {
  const { messages, send } = useChat(roomId, myId, nickname);
  const isDesktop = useIsDesktop();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(messages.length);

  // 새 메시지가 오면 맨 아래로 스크롤
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // 모바일에서 창이 닫혀 있을 때 받은 메시지는 안 읽음 배지로 표시
  useEffect(() => {
    const grew = messages.length - prevCount.current;
    if (grew > 0) {
      const last = messages[messages.length - 1];
      if (last.playerId !== myId && !isDesktop && !mobileOpen) {
        setUnread((u) => u + grew);
      }
    }
    prevCount.current = messages.length;
  }, [messages, myId, isDesktop, mobileOpen]);

  // 데스크톱 패널이 본문 위에 겹치지 않도록 오른쪽에 여백을 만든다
  useEffect(() => {
    if (!isDesktop || !nickname) return;
    document.body.style.paddingRight = `${DESKTOP_WIDTH}px`;
    return () => {
      document.body.style.paddingRight = "";
    };
  }, [isDesktop, nickname]);

  if (!nickname) return null;

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    send(text);
    onSent?.(text);
    setInput("");
  };

  const body = (
    <>
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="font-plex text-xs text-mud">아직 메시지가 없습니다. 먼저 인사해 보세요.</p>
        )}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} mine={m.playerId === myId} />
        ))}
      </div>
      <div className="flex gap-2 border-t border-mud/30 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={300}
          placeholder="메시지 입력…"
          className="min-w-0 flex-1 rounded border border-mud/40 bg-white/60 px-3 py-2 text-sm text-ink outline-none focus:border-vermil"
        />
        <button
          onClick={submit}
          disabled={!input.trim()}
          className="shrink-0 rounded bg-ink px-4 py-2 text-sm text-paper transition hover:bg-ink-soft disabled:opacity-40"
        >
          전송
        </button>
      </div>
    </>
  );

  if (isDesktop) {
    return (
      <aside
        className="fixed inset-y-0 right-0 z-30 flex flex-col border-l border-mud/30 bg-paper shadow-xl"
        style={{ width: DESKTOP_WIDTH }}
      >
        <div className="border-b border-mud/30 px-4 py-3">
          <p className="font-plex text-xs uppercase tracking-widest text-mud">채팅</p>
        </div>
        {body}
      </aside>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setMobileOpen(true);
          setUnread(0);
        }}
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-2xl text-paper shadow-lg"
        aria-label="채팅 열기"
      >
        💬
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-vermil font-plex text-[10px] text-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-paper">
          <div className="flex items-center justify-between border-b border-mud/30 px-4 py-3">
            <p className="font-semibold">채팅</p>
            <button
              onClick={() => setMobileOpen(false)}
              className="text-xl text-mud transition hover:text-ink"
              aria-label="채팅 닫기"
            >
              ✕
            </button>
          </div>
          {body}
        </div>
      )}
    </>
  );
}

function ChatBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <div className={mine ? "text-right" : "text-left"}>
      <p className="font-plex text-[10px] text-mud">{mine ? "나" : message.nickname}</p>
      <p
        className={`mt-0.5 inline-block max-w-[85%] break-words rounded-lg px-3 py-1.5 text-left text-sm ${
          mine ? "bg-ink text-paper" : "border border-mud/30 bg-paper-deep text-ink-soft"
        }`}
      >
        {message.message}
      </p>
    </div>
  );
}
