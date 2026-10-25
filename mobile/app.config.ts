import type { ConfigContext, ExpoConfig } from 'expo/config';

declare const __dirname: string;
declare const require: (id: string) => {
  existsSync: (file: string) => boolean;
  join: (...parts: string[]) => string;
};

const fs = require('node:fs');
const path = require('node:path');
const googleServicesFile = path.join(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesFile);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tavelo',
  slug: 'tavelo',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'tavelo',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.tavelo.app',
  },
  android: {
    package: 'com.tavelo.app',
    softwareKeyboardLayoutMode: 'resize',
    predictiveBackGestureEnabled: false,
    ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    adaptiveIcon: {
      backgroundColor: '#087F78',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#087F78',
        defaultChannel: 'trip-updates',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Tavelo to access your photos and videos for profile, covers, and trip memories.',
      },
    ],
    'expo-video',
    [
      'expo-media-library',
      {
        photosPermission: 'Allow Tavelo to save downloaded trip photos and videos to your library.',
        savePhotosPermission: 'Allow Tavelo to save downloaded trip photos and videos to your library.',
      },
    ],
    '@react-native-community/datetimepicker',
    ...(process.env.APP_ENV === 'production' ? [] : ['./plugins/withCleartextTraffic.js']),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    eas: {
      projectId: 'e9ee6c12-19b5-403b-ad09-d685ece26e70',
    },
  },
});
