import type { ConfigContext, ExpoConfig } from 'expo/config';

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
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
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
});
