const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const topicShim = path.resolve(__dirname, 'shims/TopicSubscriptionModule.android.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath.replace(/\\/g, '/');
  if (
    platform === 'android' &&
    moduleName === './TopicSubscriptionModule' &&
    origin.includes('/expo-notifications/')
  ) {
    return { type: 'sourceFile', filePath: topicShim };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
