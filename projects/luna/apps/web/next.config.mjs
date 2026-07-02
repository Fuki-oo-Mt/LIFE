/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Live2D（pixi-live2d-display）を後から導入した場合に必要になる設定。
  // 既定のSVGフォールバックのみでも問題なく動作する。
  transpilePackages: ["pixi-live2d-display"],
};

export default nextConfig;
