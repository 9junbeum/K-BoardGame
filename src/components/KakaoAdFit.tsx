"use client";

import { useEffect } from "react";

interface KakaoAdFitProps {
  adUnit: string;
  width: number;
  height: number;
}

/**
 * 카카오 애드핏 배너. ba.min.js는 로드되는 시점에 DOM에 있는 .kakao_ad_area만
 * 스캔해 초기화하므로, 클라이언트 라우팅으로 이 컴포넌트가 다시 마운트될 때마다
 * 스크립트 태그를 새로 주입해 광고가 매번 정상적으로 뜨도록 한다.
 */
export default function KakaoAdFit({ adUnit, width, height }: KakaoAdFitProps) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "//t1.kakaocdn.net/kas/static/ba.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [adUnit]);

  return (
    <div className="flex justify-center">
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={adUnit}
        data-ad-width={String(width)}
        data-ad-height={String(height)}
      />
    </div>
  );
}
