/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads .afm font metrics from disk; bundling breaks __dirname (e.g. E:\ROOT\...).
  serverExternalPackages: ["pdfkit"],
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
