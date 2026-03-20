import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '@/constants/Colors';
import { useCategoryStore } from '@/stores/useCategoryStore';
import type { CategoryType } from '@/types/database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THEME_COLORS: string[] = [
  '#7c3aed',
  '#059669',
  '#dc4a2d',
  '#b45309',
  '#1d4ed8',
  '#be185d',
  '#0f766e',
  '#4338ca',
  '#65a30d',
  '#0891b2',
  '#db2777',
  '#475569',
];

// ---------------------------------------------------------------------------
// Stepper component
// ---------------------------------------------------------------------------

interface StepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function Stepper({ value, min, max, step, onChange }: StepperProps) {
  return (
    <View style={stepperStyles.row}>
      <TouchableOpacity
        style={[stepperStyles.btn, value <= min && stepperStyles.btnDisabled]}
        onPress={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[stepperStyles.btnText, value <= min && stepperStyles.btnTextDisabled]}>
          −
        </Text>
      </TouchableOpacity>
      <Text style={stepperStyles.value}>{value}</Text>
      <TouchableOpacity
        style={[stepperStyles.btn, value >= max && stepperStyles.btnDisabled]}
        onPress={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[stepperStyles.btnText, value >= max && stepperStyles.btnTextDisabled]}>
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 24,
  },
  btnTextDisabled: {
    color: COLORS.textMuted,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 40,
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CategoryEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const editId = params.id ?? null;
  const paramType = (params.type as CategoryType) ?? 'study';

  const {
    getCategoryById,
    getActiveSubcategories,
    addCategory,
    updateCategory,
    archiveCategory,
    addSubcategory,
    toggleSubcategory,
    fetchCurriculumTasks,
    curriculumTasks,
    error,
    clearError,
  } = useCategoryStore();

  const isEditMode = !!editId;

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------

  const [categoryType, setCategoryType] = useState<CategoryType>(paramType);
  const [name, setName] = useState('');
  const [color, setColor] = useState(THEME_COLORS[0]);
  const [weeklyTarget, setWeeklyTarget] = useState(0);
  const [hasCurriculum, setHasCurriculum] = useState(false);
  const [isAddingSubcat, setIsAddingSubcat] = useState(false);
  const [newSubcatName, setNewSubcatName] = useState('');

  // ---------------------------------------------------------------------------
  // Load category data in edit mode
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!editId) return;
    const cat = getCategoryById(editId);
    if (!cat) return;
    setCategoryType(cat.type);
    setName(cat.name);
    setColor(cat.color);
    setWeeklyTarget(cat.weekly_target ?? 0);
    setHasCurriculum(cat.has_curriculum);

    if (cat.has_curriculum) {
      fetchCurriculumTasks(editId);
    }
  }, [editId]);

  // Reload curriculum tasks if hasCurriculum is toggled on
  useEffect(() => {
    if (isEditMode && hasCurriculum && editId) {
      fetchCurriculumTasks(editId);
    }
  }, [hasCurriculum]);

  // ---------------------------------------------------------------------------
  // Error handling for toggleSubcategory "last active" guard
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (error) {
      Alert.alert('変更できません', error, [
        { text: 'OK', onPress: clearError },
      ]);
    }
  }, [error]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const category = editId ? getCategoryById(editId) : null;
  const subcategories = category?.sub_categories ?? [];

  const curriculumCount = editId
    ? (curriculumTasks[editId] ?? []).length
    : 0;

  const weeklyMax = categoryType === 'study' ? 50 : 600;
  const weeklyStep = categoryType === 'exercise' ? 15 : 1;

  function weeklyTargetLabel(): string {
    if (weeklyTarget === 0) return '未設定';
    if (categoryType === 'study') {
      const hours = Math.round((weeklyTarget * 25) / 60 * 10) / 10;
      return `🍅 ×${weeklyTarget} / 週（約${hours}h）`;
    }
    const hours = Math.round((weeklyTarget / 60) * 10) / 10;
    return `${weeklyTarget}分 / 週（約${hours}h）`;
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleDelete() {
    if (!editId) return;
    Alert.alert(
      'カテゴリをアーカイブ',
      `「${name}」をアーカイブしますか？\n関連する予定には影響しません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'アーカイブ',
          style: 'destructive',
          onPress: async () => {
            await archiveCategory(editId);
            router.back();
          },
        },
      ]
    );
  }

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;

    try {
      if (isEditMode && editId) {
        await updateCategory(editId, {
          name: name.trim(),
          color,
          weekly_target: weeklyTarget === 0 ? null : weeklyTarget,
          has_curriculum: hasCurriculum,
        });
      } else {
        await addCategory({
          type: categoryType,
          name: name.trim(),
          color,
          icon: null,
          sort_order: 999,
          weekly_target: weeklyTarget === 0 ? null : weeklyTarget,
          has_curriculum: hasCurriculum,
        });
      }
      router.back();
    } catch {
      // Error is set in store and shown via useEffect
    }
  }, [name, color, weeklyTarget, hasCurriculum, categoryType, editId, isEditMode]);

  async function handleAddSubcategory() {
    if (!newSubcatName.trim() || !editId) return;
    await addSubcategory(editId, {
      name: newSubcatName.trim(),
      icon: '📌',
      sort_order: subcategories.length,
      is_active: true,
    });
    setNewSubcatName('');
    setIsAddingSubcat(false);
  }

  function handleToggleSubcategory(subId: string) {
    if (!editId) return;
    toggleSubcategory(subId, editId);
  }

  // ---------------------------------------------------------------------------
  // Header title and right button
  // ---------------------------------------------------------------------------

  const headerTitle = isEditMode ? (name || 'カテゴリ編集') : '新規カテゴリ';

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerRight: isEditMode
            ? () => (
                <TouchableOpacity onPress={handleDelete} style={styles.headerDeleteBtn}>
                  <Text style={styles.headerDeleteText}>削除</Text>
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ---------------------------------------------------------------- */}
          {/* 1. 科目名                                                         */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="例: 民法"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              autoFocus={!isEditMode}
            />
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* 2. テーマカラー                                                    */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>テーマカラー</Text>
            <View style={styles.colorRow}>
              {THEME_COLORS.map((c) => {
                const isSelected = color === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      isSelected && styles.colorDotSelected,
                    ]}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {isSelected && (
                      <Text style={styles.colorDotCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* 3. 学習内訳 (edit mode only)                                      */}
          {/* ---------------------------------------------------------------- */}
          {isEditMode && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>
                  {categoryType === 'study'
                    ? '学習内訳'
                    : categoryType === 'exercise'
                    ? 'トレーニング内訳'
                    : '生活内訳'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsAddingSubcat(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.addSubcatBtnText}>+ 追加</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.subcatDescription}>
                全項目にON/OFFトグル。最低1つON必須。追加時は自動ON。
              </Text>

              {subcategories.map((sub) => (
                <View key={sub.id} style={styles.subcatRow}>
                  <View style={styles.subcatIconWrap}>
                    <Text style={styles.subcatIcon}>{sub.icon ?? '📌'}</Text>
                  </View>
                  <Text style={styles.subcatName} numberOfLines={1}>
                    {sub.name}
                  </Text>
                  <Switch
                    value={sub.is_active}
                    onValueChange={() => handleToggleSubcategory(sub.id)}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={sub.is_active ? '#fff' : COLORS.textMuted}
                    ios_backgroundColor={COLORS.border}
                  />
                </View>
              ))}

              {isAddingSubcat && (
                <View style={styles.addSubcatRow}>
                  <TextInput
                    style={styles.addSubcatInput}
                    value={newSubcatName}
                    onChangeText={setNewSubcatName}
                    placeholder="内訳名を入力"
                    placeholderTextColor={COLORS.textMuted}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddSubcategory}
                  />
                  <TouchableOpacity
                    style={[
                      styles.addSubcatConfirmBtn,
                      !newSubcatName.trim() && styles.addSubcatConfirmBtnDisabled,
                    ]}
                    onPress={handleAddSubcategory}
                    disabled={!newSubcatName.trim()}
                  >
                    <Text style={styles.addSubcatConfirmText}>追加</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addSubcatCancelBtn}
                    onPress={() => {
                      setIsAddingSubcat(false);
                      setNewSubcatName('');
                    }}
                  >
                    <Text style={styles.addSubcatCancelText}>×</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* 4. 週間目標                                                        */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {categoryType === 'study' ? '週間目標（ポモドーロ）' : '週間目標（分）'}
            </Text>
            <View style={styles.stepperRow}>
              <Stepper
                value={weeklyTarget}
                min={0}
                max={weeklyMax}
                step={weeklyStep}
                onChange={setWeeklyTarget}
              />
            </View>
            <Text style={styles.weeklyTargetLabel}>{weeklyTargetLabel()}</Text>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* 5. カリキュラム (study only)                                       */}
          {/* ---------------------------------------------------------------- */}
          {categoryType === 'study' && (
            <View style={styles.section}>
              <View style={styles.curriculumRow}>
                <Text style={styles.curriculumLabel}>カリキュラム機能</Text>
                <Switch
                  value={hasCurriculum}
                  onValueChange={(v) => {
                    setHasCurriculum(v);
                    if (v && isEditMode && editId) {
                      fetchCurriculumTasks(editId);
                    }
                  }}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={hasCurriculum ? '#fff' : COLORS.textMuted}
                  ios_backgroundColor={COLORS.border}
                />
              </View>

              {hasCurriculum && isEditMode && editId && (
                <TouchableOpacity
                  style={styles.curriculumNavRow}
                  onPress={() => router.push(`/curriculum?categoryId=${editId}`)}
                >
                  <Text style={styles.curriculumNavText}>
                    カリキュラムを管理
                  </Text>
                  <Text style={styles.curriculumNavCount}>
                    {curriculumCount}件
                  </Text>
                  <Text style={styles.curriculumNavArrow}>›</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* 6. 保存ボタン                                                      */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.saveSection}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                !name.trim() && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.saveBtnText}>保存する</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Header
  headerDeleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerDeleteText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '600',
  },

  // Sections
  section: {
    backgroundColor: COLORS.surface,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  // Name input
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  // Color dots
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  colorDotCheck: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },

  // Subcategory
  subcatDescription: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
    lineHeight: 16,
  },
  subcatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceElevated,
    gap: 12,
  },
  subcatIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcatIcon: {
    fontSize: 18,
  },
  subcatName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  addSubcatBtnText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  addSubcatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  addSubcatInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.primaryLight,
  },
  addSubcatConfirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addSubcatConfirmBtnDisabled: {
    opacity: 0.4,
  },
  addSubcatConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  addSubcatCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addSubcatCancelText: {
    fontSize: 18,
    color: COLORS.textMuted,
    lineHeight: 22,
  },

  // Stepper row
  stepperRow: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  weeklyTargetLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  // Curriculum
  curriculumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  curriculumLabel: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  curriculumNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  curriculumNavText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '500',
  },
  curriculumNavCount: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginRight: 4,
  },
  curriculumNavArrow: {
    fontSize: 20,
    color: COLORS.textMuted,
  },

  // Save button
  saveSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  bottomPadding: {
    height: 40,
  },
});
