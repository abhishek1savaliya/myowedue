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
  // Vercel Node middleware/lambdas have been missing this module at runtime (Next 16.2.x).
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@swc/helpers/**/*"],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };
    if (isServer) {
      const pkgExternals = ["bullmq", "ioredis", "node-cron"];
      const prev = config.externals;
      config.externals = [
        ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
        ...pkgExternals,
        ({ request }, callback) => {
          if (request && (pkgExternals.includes(request) || request.startsWith("bullmq/"))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    } else {
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
