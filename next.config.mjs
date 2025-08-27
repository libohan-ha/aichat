/** @type {import('next').NextConfig} */
const devAllowed = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Allow dev assets to be requested from LAN devices (Next.js 15+ warning)
    // Configure via .env: ALLOWED_DEV_ORIGINS=http://192.168.124.254:3001
    allowedDevOrigins: devAllowed.length ? devAllowed : undefined,
  },
  async headers() {
    // Relax CORS for Next static assets in development when accessing from LAN
    if (process.env.NODE_ENV !== "development") return []
    const allow = devAllowed[0] || "*"
    return [
      {
        source: "/_next/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allow },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ]
  },
}

export default nextConfig
