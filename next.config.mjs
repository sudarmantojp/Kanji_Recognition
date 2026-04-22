/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export — works on GitHub Pages, Netlify, and any CDN
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
