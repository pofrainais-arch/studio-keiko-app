/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pptxgenjs (présentation PowerPoint générée dans le navigateur) référence des modules Node inutiles côté client.
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (res) => { res.request = res.request.replace(/^node:/, ""); }));
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false, path: false, os: false, "image-size": false };
    }
    return config;
  },
};
export default nextConfig;
