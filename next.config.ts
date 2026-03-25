import type { NextConfig } from 'next';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            { from: 'node_modules/cesium/Build/Cesium/Workers', to: '../public/cesiumStatic/Workers' },
            { from: 'node_modules/cesium/Build/Cesium/ThirdParty', to: '../public/cesiumStatic/ThirdParty' },
            { from: 'node_modules/cesium/Build/Cesium/Assets', to: '../public/cesiumStatic/Assets' },
            { from: 'node_modules/cesium/Build/Cesium/Widgets', to: '../public/cesiumStatic/Widgets' }
          ]
        })
      );
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    }
    return config;
  }
};

export default nextConfig;
