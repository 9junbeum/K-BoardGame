"use client";

import { useEffect, useRef, useState } from "react";

interface GameCardProps {
  slug: string;
  label: string;
  badge?: string;
  onClick: () => void;
  disabled?: boolean;
}

/** 로비의 게임 선택 카드. public/games/{slug}.png 가 없으면 자리표시 카드로 대체된다 */
export default function GameCard({ slug, label, badge, onClick, disabled }: GameCardProps) {
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 로컬 404 응답은 매우 빨라서, 하이드레이션이 끝나기 전에 브라우저가 이미 error를
  // 발생시켜 React의 onError가 이를 놓치는 경우가 있다. 마운트 시 이미 실패한
  // 상태(complete=true, naturalWidth=0)인지 직접 확인해 그 경우도 폴백으로 잡는다.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setImgError(true);
    }
  }, []);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative aspect-square overflow-hidden rounded-xl border border-mud/30 bg-paper-deep text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-50"
    >
      {!imgError ? (
        // eslint-disable-next-line @next/next/no-img-element -- public/games는 사용자가 나중에 채우는 로컬 정적 이미지라 최적화 파이프라인이 불필요하다
        <img
          ref={imgRef}
          src={`/games/${slug}.png`}
          alt={label}
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-paper-deep to-mud/15">
          <span className="font-plex text-[11px] text-mud">이미지 준비 중</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/5 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
        <span className="text-base font-semibold text-paper drop-shadow-sm">{label}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-paper/90 px-2 py-0.5 font-plex text-[10px] text-ink">
            {badge}
          </span>
        )}
      </div>
    </button>
  );
}
