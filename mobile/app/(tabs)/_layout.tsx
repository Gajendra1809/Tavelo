import { Tabs, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { fetchAndPublishUnreadCount } from '@/hooks/useNotificationUnreadCount';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { colors } from '@/theme';

const tabs: { name: 'index' | 'trips' | 'expenses' | 'memories' | 'profile'; title: string; icon: AndroidSymbol }[] =
  [
    { name: 'index', title: 'Home', icon: 'home' },
    { name: 'trips', title: 'Trips', icon: 'flight' },
    { name: 'expenses', title: 'Expenses', icon: 'payments' },
    { name: 'memories', title: 'Memories', icon: 'photo_library' },
    { name: 'profile', title: 'Profile', icon: 'person' },
  ];

export default function TabLayout() {
  useFocusEffect(
    useCallback(() => {
      void fetchAndPublishUnreadCount();
    }, []),
  );

  return (
    <View style={{ flex: 1 }}>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: colors.primaryPressed,
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color }) => (
              <SymbolView name={{ android: tab.icon, web: tab.icon }} size={22} tintColor={color} />
            ),
          }}
        />
      ))}
    </Tabs>
    </View>
  );
}
