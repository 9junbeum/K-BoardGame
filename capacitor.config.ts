import type { CapacitorConfig } from "@capacitor/cli";

// 이 앱은 별도 번들을 배포하지 않고, 실제 서비스 중인 웹사이트(Vercel)를
// 네이티브 WebView로 그대로 감싸서 보여준다. webDir(capacitor-www)은 Capacitor의
// 필수 설정 항목이라 최소한의 자리표시 폴더만 둔다 — 실제로는 로드되지 않는다.
const config: CapacitorConfig = {
  appId: "com.kbg.app",
  appName: "KBG",
  webDir: "capacitor-www",
  server: {
    url: "https://omok-online-kappa.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
