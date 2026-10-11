import { Stack, useLocalSearchParams } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { TripMemoriesScreen } from '@/features/memories/TripMemoriesScreen';
import { colors } from '@/theme';

export default function TripMemoriesRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? '';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Memories',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <TripMemoriesScreen tripId={id} />
    </>
  );
}
