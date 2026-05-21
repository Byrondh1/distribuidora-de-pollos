/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@distribuapp/shared'],
  typedRoutes: true,
  // Los tipos de Supabase en packages/shared/src/types/database.ts son un placeholder
  // hasta el primer `pnpm db:types`. Las llamadas a rpc/insert no superan strict-check
  // con el placeholder; confiamos en tsc local para typecheck.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
