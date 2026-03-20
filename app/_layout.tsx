import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/Colors';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// アプリ状態
// ---------------------------------------------------------------------------

type AppState = 'loading' | 'auth' | 'onboarding' | 'ready';

/** session → user_settings の有無を確認して AppState を決定 */
async function resolveAppState(session: Session | null): Promise<AppState> {
  if (!session) return 'auth';

  try {
    const { data } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    return data ? 'ready' : 'onboarding';
  } catch {
    // ネットワークエラー等は onboarding にフォールバック
    return 'onboarding';
  }
}

// ---------------------------------------------------------------------------
// ルートレイアウト
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const router          = useRouter();
  const [appState, setAppState] = useState<AppState>('loading');
  const splashHidden    = useRef(false);

  const hideSplash = () => {
    if (!splashHidden.current) {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  };

  useEffect(() => {
    let mounted = true;

    // ── 初期セッションチェック ──
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const state = await resolveAppState(session);
      setAppState(state);
      hideSplash();
    });

    // ── 認証状態の変化を購読 ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          setAppState('auth');
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const state = await resolveAppState(session);
          setAppState(state);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── 状態に応じてリダイレクト ──
  useEffect(() => {
    if (appState === 'loading') return;

    if (appState === 'auth') {
      router.replace('/auth');
    } else if (appState === 'onboarding') {
      router.replace('/onboarding/wake-sleep');
    } else {
      router.replace('/(tabs)');
    }
  }, [appState]);

  // ローディング中はスプラッシュを維持（nullを返すとスプラッシュが自動非表示になるため）
  if (appState === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)"       options={{ headerShown: false }} />
      <Stack.Screen name="auth"         options={{ headerShown: false }} />
      <Stack.Screen name="onboarding"   options={{ headerShown: false }} />
      <Stack.Screen name="settings"     options={{ headerShown: false }} />
      <Stack.Screen
        name="curriculum"
        options={{
          headerShown:          true,
          headerStyle:          { backgroundColor: '#ffffff' },
          headerTintColor:      '#0f172a',
          headerTitleStyle:     { fontWeight: '700', fontSize: 17 },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible:  false,
        }}
      />
      <Stack.Screen
        name="category-list"
        options={{
          headerShown:          true,
          headerStyle:          { backgroundColor: '#ffffff' },
          headerTintColor:      '#0f172a',
          headerTitleStyle:     { fontWeight: '700', fontSize: 17 },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible:  false,
        }}
      />
      <Stack.Screen
        name="category-edit"
        options={{
          headerShown:          true,
          headerStyle:          { backgroundColor: '#ffffff' },
          headerTintColor:      '#0f172a',
          headerTitleStyle:     { fontWeight: '700', fontSize: 17 },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible:  false,
        }}
      />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
