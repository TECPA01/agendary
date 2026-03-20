import { Stack } from 'expo-router';
import { COLORS } from '@/constants/Colors';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle:     { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle:{ fontWeight: '700', fontSize: 17 },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        contentStyle:    { backgroundColor: COLORS.background },
      }}
    />
  );
}
