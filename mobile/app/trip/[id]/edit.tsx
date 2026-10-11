import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { EditTripScreen } from '@/features/trips/EditTripScreen';
import { colors } from '@/theme';

export default function EditTripRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit trip',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <EditTripScreen />
    </>
  );
}
