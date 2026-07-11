/** @type {import('next').NextConfig} */
const nextConfig = {
  // 実アダプタSDK(@aws-sdk / snowflake-sdk)は動的importするため、
  // 未インストールでもビルド/起動できるよう外部化しておく。
  serverExternalPackages: ["@aws-sdk/client-cloudwatch", "snowflake-sdk", "@octokit/rest", "@anthropic-ai/sdk"],
};

export default nextConfig;
