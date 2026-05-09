/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      canvas: "./src/shims/empty.js",
    },
  },
};

export default nextConfig;
