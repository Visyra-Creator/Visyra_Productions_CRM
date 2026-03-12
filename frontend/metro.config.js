// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Add resolver configuration
config.resolver = {
  ...config.resolver,
  // Ignore macOS metadata files and DS_Store
  blockList: [
    /.*\/\._.*/,
    /.*\.DS_Store/
  ],
  resolveRequest: (context, moduleName, platform) => {
    // Exclude expo-sqlite on web platform
    if (platform === 'web' && moduleName.includes('expo-sqlite')) {
      return {
        type: 'empty',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
