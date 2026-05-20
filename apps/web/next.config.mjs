/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@distribuapp/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
