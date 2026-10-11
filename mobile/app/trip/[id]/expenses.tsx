import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { TripExpensesScreen } from '@/features/expenses/TripExpensesScreen';
import { colors } from '@/theme';

export default function TripExpensesRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Expenses',
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.sky },
          headerTitleStyle: { color: colors.ink },
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <TripExpensesScreen />
    </>
  );
}
