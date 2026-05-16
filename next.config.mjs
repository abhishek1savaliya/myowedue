/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads .afm font metrics from disk; bundling breaks __dirname (e.g. E:\ROOT\...).
  serverExternalPackages: [
    "pdfkit",
    "mongoose",
    "mongodb",
    "bullmq",
    "ioredis",
    "node-cron",
  ],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    if (!isServer) {
      const stub = false;
      config.resolve.alias = {
        ...config.resolve.alias,
        mongoose: stub,
        mongodb: stub,
        bullmq: stub,
        ioredis: stub,
      };
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      canvas: "./src/shims/empty.js",
    },
  },
};

export default nextConfig;
