import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@ax/bridge"],
  images: { unoptimized: true },
  poweredByHeader: false,
  // 개발 중 휴대폰·에뮬레이터 앱이 PC의 사설 IP(192.168.x.x:3000 등)나 adb reverse(127.0.0.1)로 웹을 띄울 수 있게 한다.
  // 개발 서버에만 적용된다. 빠지면 웹뷰에서 화면은 보이지만 hydration 이 안 돼 버튼이 동작하지 않는다.
  // *.trycloudflare.com: 다른 네트워크의 폰에서 테스트할 때 쓰는 Cloudflare 임시 터널 주소
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "172.*.*.*", "*.trycloudflare.com"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
