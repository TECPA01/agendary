import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '@/constants/Colors';

// ---------------------------------------------------------------------------
// タイマータブ専用カラー
// ---------------------------------------------------------------------------

const TIMER_BG    = '#0f172a';
const TIMER_CYAN  = '#22d3ee';
const TIMER_DIM   = 'rgba(255,255,255,0.25)';

// ---------------------------------------------------------------------------
// アイコン設定
// ---------------------------------------------------------------------------

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconConfig {
  iosSymbol: string;            // SF Symbols 名
  ionicon: IoniconName;         // Ionicons 名（フォーカス時）
  ioniconOutline: IoniconName;  // Ionicons 名（非フォーカス時）
}

const TAB_ICONS: Record<string, TabIconConfig> = {
  index: {
    iosSymbol:      'house.fill',
    ionicon:        'home',
    ioniconOutline: 'home-outline',
  },
  calendar: {
    iosSymbol:      'calendar',
    ionicon:        'calendar',
    ioniconOutline: 'calendar-outline',
  },
  timer: {
    iosSymbol:      'timer',
    ionicon:        'timer',
    ioniconOutline: 'timer-outline',
  },
  report: {
    iosSymbol:      'chart.bar.fill',
    ionicon:        'bar-chart',
    ioniconOutline: 'bar-chart-outline',
  },
  settings: {
    iosSymbol:      'gearshape.fill',
    ionicon:        'settings',
    ioniconOutline: 'settings-outline',
  },
};

// ---------------------------------------------------------------------------
// TabIcon コンポーネント
// ---------------------------------------------------------------------------

function TabIcon({
  tab,
  focused,
  color,
  size,
}: {
  tab: string;
  focused: boolean;
  color: string;
  size: number;
}) {
  const cfg = TAB_ICONS[tab];
  if (!cfg) return null;

  // iOS: expo-symbols（SF Symbols） を使用
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={cfg.iosSymbol as Parameters<typeof SymbolView>[0]['name']}
        style={{ width: size, height: size }}
        type={focused ? 'hierarchical' : 'monochrome'}
        tintColor={color}
        fallback={
          <Ionicons
            name={focused ? cfg.ionicon : cfg.ioniconOutline}
            size={size}
            color={color}
          />
        }
      />
    );
  }

  // Android / Web: Ionicons
  return (
    <Ionicons
      name={focused ? cfg.ionicon : cfg.ioniconOutline}
      size={size}
      color={color}
    />
  );
}

// ---------------------------------------------------------------------------
// レイアウト
// ---------------------------------------------------------------------------

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor:  COLORS.border,
        },
        tabBarLabelStyle: {
          fontSize:   10,
          fontWeight: '600',
          marginBottom: 2,
        },
        headerStyle:     { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
      }}
    >
      {/* ── ホーム ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon tab="index" focused={focused} color={color} size={size} />
          ),
        }}
      />

      {/* ── 予定 ── */}
      <Tabs.Screen
        name="calendar"
        options={{
          title: '予定',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon tab="calendar" focused={focused} color={color} size={size} />
          ),
        }}
      />

      {/* ── タイマー（暗転スタイル） ── */}
      <Tabs.Screen
        name="timer"
        options={{
          title: 'タイマー',
          headerShown: false,
          // タイマータブ専用オーバーライド:
          // アクティブ時はタブバー全体が暗転し、他タブは dim になる
          tabBarStyle: {
            backgroundColor: TIMER_BG,
            borderTopColor:  'rgba(255,255,255,0.08)',
          },
          tabBarActiveTintColor:   TIMER_CYAN,
          tabBarInactiveTintColor: TIMER_DIM,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon tab="timer" focused={focused} color={color} size={size} />
          ),
        }}
      />

      {/* ── レポート ── */}
      <Tabs.Screen
        name="report"
        options={{
          title: 'レポート',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon tab="report" focused={focused} color={color} size={size} />
          ),
        }}
      />

      {/* ── 設定 ── */}
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon tab="settings" focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
