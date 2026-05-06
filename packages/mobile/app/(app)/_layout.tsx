import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme/ThemeProvider';

// Mobile 모든 메뉴 아이콘은 단색 외곽선만 (코드 컴벤션 §14.5).
// Feather = lucide 의 모회사 — outline 일관성 + Expo 51 번들 포함.
type FeatherName = React.ComponentProps<typeof Feather>['name'];

function TabIcon({ name, color }: { name: FeatherName; color: string }) {
  return <Feather name={name} size={22} color={color} />;
}

export default function AppTabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation('nav');
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
          title: t('home'),
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="auditions/index"
        options={{
          title: t('auditions'),
          tabBarIcon: ({ color }) => <TabIcon name="award" color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: t('shop'),
          tabBarIcon: ({ color }) => <TabIcon name="shopping-bag" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
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
