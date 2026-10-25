import { requireOptionalNativeModule } from 'expo-modules-core';

// Expo Go 57 does not register ExpoTopicSubscriptionModule. Requiring it at
// import time crashes the whole app. A real APK still receives the native module.
const native = requireOptionalNativeModule('ExpoTopicSubscriptionModule');

const unavailable = {
  addListener() {},
  removeListeners() {},
  subscribeToTopicAsync() {
    return Promise.resolve(null);
  },
  unsubscribeFromTopicAsync() {
    return Promise.resolve(null);
  },
};

export default native ?? unavailable;
