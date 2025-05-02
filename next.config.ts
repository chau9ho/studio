import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Allow loading base64 encoded images displayed via src attribute
       {
        protocol: 'data',
        hostname: '',
        port: '',
        pathname: '/**',
      },
    ],
      // Allow loading images via blob URLs (e.g., URL.createObjectURL)
      // Note: This might require additional configuration depending on Next.js version.
      // For newer versions, `remotePatterns` might not directly support blob URLs.
      // If issues arise, consider serving the blob through a temporary server route or
      // directly using <img> tags instead of next/image for blob URLs.
      // The 'data:' protocol above should cover most base64 cases.
  },
};

export default nextConfig;
