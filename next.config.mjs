/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com', pathname: '/**' }]
  },
  experimental: {
    serverActions: { bodySizeLimit: '12mb' }
  }
};

export default nextConfig;
