import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true, // Consider setting this to false for better type safety
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true, // Consider setting this to false for better code quality
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Removed 'data:' protocol pattern for security reasons.
      // Base64 strings can be used directly in `src` for `<img>` tags.
      // For Blobs, use URL.createObjectURL() and manage the lifecycle.
      // `next/image` does not directly support Data URLs or Blob URLs in `src`.
    ],
  },
  // Recommended: Enable React Strict Mode for identifying potential problems in an application.
  reactStrictMode: true,
};

export default nextConfig;
