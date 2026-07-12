"use client";

import { useEffect, useState } from "react";

/**
 * 정밀한 호버가 안 되는 입력(터치 등)인지 여부.
 * true면 "탭해서 선택 → 아래 버튼으로 확정" UX를, false면 마우스 호버 미리보기를 쓴다.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return coarse;
}
