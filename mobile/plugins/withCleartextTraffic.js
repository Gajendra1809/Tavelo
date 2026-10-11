// @ts-nocheck
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/** Allows http:// during local Android builds. Production builds skip this plugin. */
function withCleartextTraffic(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      modConfig.modResults,
    );
    application.$['android:usesCleartextTraffic'] = 'true';
    return modConfig;
  });
}

module.exports = withCleartextTraffic;
