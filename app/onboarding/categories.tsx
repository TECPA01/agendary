import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { DEFAULTS } from '@/constants/defaults';
import { StepIndicator } from '@/components/common/StepIndicator';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

type CategoryType = 'study' | 'exercise' | 'life';

const TABS: { key: CategoryType; label: string; emoji: string }[] = [
  { key: 'study',    label: '学習', emoji: '📚' },
  { key: 'exercise', label: '運動', emoji: '🏃' },
  { key: 'life',     label: '生活', emoji: '🏠' },
];

export default function CategoriesScreen() {
  const [activeTab, setActiveTab] = useState<CategoryType>('study');
  const { categories, toggleCategory } = useOnboardingStore();

  const tabItems = categories.filter((c) => c.type === activeTab);
  const selectedCount = categories.filter((c) => c.selected).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <StepIndicator current={2} total={3} />
        <Text style={styles.title}>カテゴリを登録</Text>
        <Text style={styles.subtitle}>
          学習科目・運動・生活ルーティンを選択してください
        </Text>
      </View>

      {/* タブ */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* カテゴリ一覧 */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {tabItems.map((item) => (
          <TouchableOpacity
            key={`${item.type}-${item.name}`}
            style={[styles.item, item.selected && styles.itemSelected]}
            onPress={() => toggleCategory(item.name, item.type)}
            activeOpacity={0.75}
          >
            <View style={[styles.colorBar, { backgroundColor: item.color }]} />
            <Text style={styles.itemIcon}>{item.icon}</Text>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSub}>
                {DEFAULTS.categoryTemplates[item.type]
                  .find((t) => t.name === item.name)
                  ?.subcategories.join(' · ')}
              </Text>
            </View>
            <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
              {item.selected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.listBottom} />
      </ScrollView>

      {/* フッター */}
      <View style={styles.footer}>
        <Text style={styles.footerCount}>{selectedCount}件選択中</Text>
        <TouchableOpacity
          style={[styles.nextBtn, selectedCount === 0 && styles.nextBtnDisabled]}
          onPress={() => router.push('/onboarding/complete')}
          disabled={selectedCount === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.nextText}>次へ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    gap: 4,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#1e293b',
    fontWeight: '700',
  },
  list: {
    flex: 1,
    paddingHorizontal: 24,
  },
  listBottom: {
    height: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f3ed',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  itemSelected: {
    backgroundColor: '#ede9fe',
  },
  colorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  itemIcon: {
    fontSize: 24,
    marginLeft: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 3,
  },
  itemSub: {
    fontSize: 12,
    color: '#64748b',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  checkboxSelected: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  footerCount: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 10,
  },
  nextBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
