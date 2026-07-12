import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 중 같은 와이파이의 다른 기기에서 접속 허용 (HMR 웹소켓 차단 해제)
  // PC의 LAN IP가 바뀌면 여기에 추가하세요.
  allowedDevOrigins: ["192.168.0.5", "192.168.0.*", "192.168.21.*"],
};

export default nextConfig;
