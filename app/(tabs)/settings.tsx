import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/Colors';

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

interface SettingItem {
  icon:        string;
  iconBg:      string;
  title:       string;
  description: string;
  route?:      string;   // 実装済みルートへの遷移
  onPress?:    () => void; // ルートなしのカスタム動作
  badge?:      string;
  disabled?:   boolean;
}

interface SettingGroup {
  label:    string;
  items:    SettingItem[];
}

// ---------------------------------------------------------------------------
// SettingRow
// ---------------------------------------------------------------------------

function SettingRow({
  item,
  isLast,
}: {
  item:   SettingItem;
  isLast: boolean;
}) {
  return (
    <TouchableOpacity
      style={[rowSt.row, isLast && rowSt.rowLast, item.disabled && rowSt.rowDisabled]}
      onPress={item.onPress}
      activeOpacity={item.disabled ? 1 : 0.6}
      disabled={item.disabled}
    >
      {/* アイコン */}
      <View style={[rowSt.iconWrap, { backgroundColor: item.iconBg }]}>
        <Text style={rowSt.icon}>{item.icon}</Text>
      </View>

      {/* テキスト */}
      <View style={rowSt.textArea}>
        <Text style={rowSt.title}>{item.title}</Text>
        <Text style={rowSt.desc} numberOfLines={1}>{item.description}</Text>
      </View>

      {/* バッジ */}
      {item.badge && (
        <View style={rowSt.badge}>
          <Text style={rowSt.badgeText}>{item.badge}</Text>
        </View>
      )}

      {/* 矢印 */}
      {!item.disabled && (
        <Text style={rowSt.chevron}>›</Text>
      )}
    </TouchableOpacity>
  );
}

const rowSt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  rowLast:     { borderBottomWidth: 0 },
  rowDisabled: { opacity: 0.45 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon:     { fontSize: 18 },
  textArea: { flex: 1, gap: 2 },
  title:    { fontSize: 15, fontWeight: '600', color: COLORS.text },
  desc:     { fontSize: 12, color: COLORS.textMuted },
  badge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#92400e', letterSpacing: 0.3 },
  chevron: { fontSize: 22, color: COLORS.textMuted, lineHeight: 26, marginLeft: 2 },
});

// ---------------------------------------------------------------------------
// GroupCard
// ---------------------------------------------------------------------------

function GroupCard({ group }: { group: SettingGroup }) {
  return (
    <View style={grpSt.wrap}>
      <Text style={grpSt.label}>{group.label}</Text>
      <View style={grpSt.card}>
        {group.items.map((item, i) => (
          <SettingRow
            key={item.title}
            item={item}
            isLast={i === group.items.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const grpSt = StyleSheet.create({
  wrap: { marginBottom: 28, gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
});

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const router = useRouter();

  function placeholder(name: string) {
    Alert.alert(name, 'この機能は近日公開予定です。');
  }

  const groups: SettingGroup[] = [
    {
      label: '基本設定',
      items: [
        {
          icon:        '📅',
          iconBg:      '#ede9fe',
          title:       '起床・就寝時刻',
          description: 'デフォルト時刻と曜日別オーバーライドを設定',
          onPress:     () => router.push('/settings/schedule'),
        },
        {
          icon:        '📂',
          iconBg:      '#d1fae5',
          title:       'カテゴリ管理',
          description: '学習・運動・生活の科目と内訳を管理',
          onPress:     () => router.push('/category-list'),
        },
        {
          icon:        '🍅',
          iconBg:      '#fee2e2',
          title:       'ポモドーロ設定',
          description: '集中・休憩・大休憩の時間を設定',
          onPress:     () => router.push('/settings/pomodoro'),
        },
      ],
    },
    {
      label: '集中サポート',
      items: [
        {
          icon:        '🔕',
          iconBg:      '#e0e7ff',
          title:       'フォーカスモード',
          description: '通知をオフにして集中をサポート',
          onPress:     () => placeholder('フォーカスモード'),
        },
        {
          icon:        '🔒',
          iconBg:      '#fef3c7',
          title:       'ロックモード',
          description: 'ポモドーロ中に他のアプリへの切替を防止',
          onPress:     () => placeholder('ロックモード'),
        },
      ],
    },
    {
      label: 'その他',
      items: [
        {
          icon:        '🔔',
          iconBg:      '#fce7f3',
          title:       'リマインダー・通知',
          description: 'セッション前通知・週間プランリマインダー',
          onPress:     () => router.push('/settings/notifications'),
        },
        {
          icon:        '📊',
          iconBg:      '#e0f2fe',
          title:       'データエクスポート',
          description: 'CSV・JSONで学習記録をエクスポート',
          onPress:     () => placeholder('データエクスポート'),
          badge:       'PRO',
        },
        {
          icon:        '💎',
          iconBg:      '#f3e8ff',
          title:       'サブスクリプション',
          description: 'AGENDARY PROの管理・アップグレード',
          onPress:     () => placeholder('サブスクリプション'),
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>設定</Text>
      </View>

      {/* グループ */}
      {groups.map((g) => (
        <GroupCard key={g.label} group={g} />
      ))}

      {/* バージョン */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>AGENDARY v1.0.0</Text>
        <Text style={styles.footerSub}>Powered by Expo SDK 55 + Supabase</Text>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  footerSub: {
    fontSize: 11,
    color: COLORS.border,
    letterSpacing: 0.2,
  },
});
