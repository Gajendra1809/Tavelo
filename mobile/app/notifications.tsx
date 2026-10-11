import { Stack } from 'expo-router';
import { View } from 'react-native';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { NotificationsScreen } from '@/features/notifications/NotificationsScreen';
import { colors } from '@/theme';

export default function NotificationsRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.sky }}>
        <NotificationsScreen />
      </View>
    </>
  );
}
