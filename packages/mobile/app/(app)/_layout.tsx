import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;
}

export default function AppTabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text2,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎤" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="auditions/index"
        options={{
          title: '오디션',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: '상점',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      <Tabs.Screen name="idol/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/[idolId]" options={{ href: null }} />
      <Tabs.Screen name="auditions/[id]" options={{ href: null }} />
      <Tabs.Screen name="auditions/past" options={{ href: null }} />
      <Tabs.Screen name="rounds/[id]/vote" options={{ href: null }} />
      <Tabs.Screen name="collection" options={{ href: null }} />
      <Tabs.Screen name="gacha/[setId]" options={{ href: null }} />
      <Tabs.Screen name="me/photocards" options={{ href: null }} />
      <Tabs.Screen name="me/memberships" options={{ href: null }} />
      <Tabs.Screen name="me/votes" options={{ href: null }} />
      <Tabs.Screen name="me/follows" options={{ href: null }} />
      <Tabs.Screen name="me/hearts" options={{ href: null }} />
      <Tabs.Screen name="me/settings" options={{ href: null }} />
    </Tabs>
  );
}
