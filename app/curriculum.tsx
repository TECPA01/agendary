import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/constants/Colors';
import { useCategoryStore } from '@/stores/useCategoryStore';
import type { CurriculumTaskRow, SubCategoryRow } from '@/types/database';

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={stpSt.row}>
      <TouchableOpacity
        style={[stpSt.btn, value <= min && stpSt.disabled]}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={stpSt.sign}>−</Text>
      </TouchableOpacity>
      <Text style={stpSt.val}>{value}</Text>
      <TouchableOpacity
        style={[stpSt.btn, value >= max && stpSt.disabled]}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={stpSt.sign}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const stpSt = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  sign:     { fontSize: 18, color: COLORS.text, lineHeight: 22 },
  val:      { fontSize: 18, fontWeight: '700', color: COLORS.text, minWidth: 36, textAlign: 'center' },
});

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: CurriculumTaskRow;
  onToggle: (task: CurriculumTaskRow) => void;
  onDelete: (id: string) => void;
}

function TaskRow({ task, onToggle, onDelete }: TaskRowProps) {
  const swipeRef = useRef<SwipeableMethods>(null);

  function renderRightActions() {
    return (
      <View style={trSt.swipeWrap}>
        <TouchableOpacity
          style={trSt.deleteBtn}
          onPress={() => {
            swipeRef.current?.close();
            Alert.alert(
              'タスクを削除',
              `「${task.name}」を削除しますか？`,
              [
                { text: 'キャンセル', style: 'cancel' },
                { text: '削除', style: 'destructive', onPress: () => onDelete(task.id) },
              ]
            );
          }}
        >
          <Text style={trSt.deleteBtnText}>削除</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const completedStr = task.completed_date
    ? task.completed_date.slice(5).replace('-', '/')  // MM/DD
    : null;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      friction={2}
    >
      <TouchableOpacity
        style={trSt.row}
        onPress={() => onToggle(task)}
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <View style={[trSt.checkbox, task.is_completed && trSt.checkboxDone]}>
          {task.is_completed && <Text style={trSt.checkMark}>✓</Text>}
        </View>

        {/* Name */}
        <Text
          style={[trSt.name, task.is_completed && trSt.nameDone]}
          numberOfLines={1}
        >
          {task.name}
        </Text>

        {/* Completed date */}
        {completedStr && (
          <Text style={trSt.date}>{completedStr}</Text>
        )}
      </TouchableOpacity>
    </ReanimatedSwipeable>
  );
}

const trSt = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, backgroundColor: COLORS.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, gap: 12, minHeight: 50 },
  checkbox:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  checkMark:    { fontSize: 13, color: '#fff', fontWeight: '700', lineHeight: 16 },
  name:         { flex: 1, fontSize: 15, color: COLORS.text },
  nameDone:     { textDecorationLine: 'line-through', color: COLORS.textMuted },
  date:         { fontSize: 12, color: COLORS.textMuted, flexShrink: 0 },
  swipeWrap:    { width: 80, justifyContent: 'center' },
  deleteBtn:    { flex: 1, backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText:{ color: '#fff', fontWeight: '600', fontSize: 13 },
});

// ---------------------------------------------------------------------------
// GroupSection
// ---------------------------------------------------------------------------

interface GroupSectionProps {
  subcat: SubCategoryRow | null;
  tasks: CurriculumTaskRow[];
  onToggle: (task: CurriculumTaskRow) => void;
  onDelete: (id: string) => void;
}

function GroupSection({ subcat, tasks, onToggle, onDelete }: GroupSectionProps) {
  const doneCount = tasks.filter((t) => t.is_completed).length;
  const total = tasks.length;
  const label = subcat
    ? `${subcat.icon ?? ''} ${subcat.name}（全${total}回）`
    : `未分類（全${total}回）`;

  return (
    <View style={gsSt.wrap}>
      <View style={gsSt.header}>
        <Text style={gsSt.headerText}>{label}</Text>
        <Text style={gsSt.progress}>{doneCount} / {total} 完了</Text>
      </View>

      {/* Progress bar */}
      <View style={gsSt.barBg}>
        <View
          style={[
            gsSt.barFill,
            { width: total > 0 ? `${(doneCount / total) * 100}%` : '0%' },
          ]}
        />
      </View>

      <View style={gsSt.card}>
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </View>
    </View>
  );
}

const gsSt = StyleSheet.create({
  wrap:       { marginBottom: 24 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 },
  headerText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  progress:   { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  barBg:      { height: 3, backgroundColor: COLORS.border, borderRadius: 2, marginBottom: 6, marginHorizontal: 4 },
  barFill:    { height: 3, backgroundColor: COLORS.success, borderRadius: 2 },
  card:       { backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
});

// ---------------------------------------------------------------------------
// BulkAddModal
// ---------------------------------------------------------------------------

interface BulkAddModalProps {
  visible: boolean;
  subcategories: SubCategoryRow[];
  categoryId: string;
  existingCount: number;
  onClose: () => void;
  onAdded: () => void;
}

function BulkAddModal({
  visible,
  subcategories,
  categoryId,
  existingCount,
  onClose,
  onAdded,
}: BulkAddModalProps) {
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [prefix, setPrefix]     = useState('第');
  const [suffix, setSuffix]     = useState('回');
  const [startNum, setStartNum] = useState(1);
  const [endNum, setEndNum]     = useState(10);
  const [saving, setSaving]     = useState(false);

  // preview: "第1回、第2回、...第10回" (show up to 3, then ellipsis if more)
  const previewNames = useMemo(() => {
    if (endNum < startNum) return [];
    const count = Math.min(endNum - startNum + 1, 100);
    return Array.from({ length: count }, (_, i) => `${prefix}${startNum + i}${suffix}`);
  }, [prefix, suffix, startNum, endNum]);

  const previewText = useMemo(() => {
    if (previewNames.length === 0) return '—';
    if (previewNames.length <= 3) return previewNames.join('、');
    return `${previewNames[0]}、${previewNames[1]}、…${previewNames[previewNames.length - 1]}`;
  }, [previewNames]);

  const totalCount = Math.max(0, endNum - startNum + 1);

  async function handleAdd() {
    if (totalCount <= 0 || totalCount > 100) {
      Alert.alert('エラー', '1〜100件の範囲で設定してください。');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const inserts = previewNames.map((name, i) => ({
        category_id:    categoryId,
        subcategory_id: selectedSubId,
        name,
        sort_order:     existingCount + i,
        is_completed:   false,
      }));

      const { error } = await supabase
        .from('curriculum_tasks')
        .insert(inserts);

      if (error) throw error;
      onAdded();
      onClose();
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '追加に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={bmSt.root}>
          {/* Header */}
          <View style={bmSt.header}>
            <TouchableOpacity onPress={onClose} style={bmSt.cancelBtn}>
              <Text style={bmSt.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <Text style={bmSt.title}>一括追加</Text>
            <TouchableOpacity
              onPress={() => void handleAdd()}
              style={[bmSt.addBtn, (saving || totalCount === 0) && bmSt.addBtnDisabled]}
              disabled={saving || totalCount === 0}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={bmSt.addBtnText}>追加</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={bmSt.scroll} contentContainerStyle={bmSt.scrollContent} keyboardShouldPersistTaps="handled">

            {/* 内訳選択 */}
            {subcategories.length > 0 && (
              <View style={bmSt.section}>
                <Text style={bmSt.sectionLabel}>内訳（オプション）</Text>
                <View style={bmSt.chipRow}>
                  <TouchableOpacity
                    style={[bmSt.chip, selectedSubId === null && bmSt.chipActive]}
                    onPress={() => setSelectedSubId(null)}
                  >
                    <Text style={[bmSt.chipText, selectedSubId === null && bmSt.chipTextActive]}>
                      なし
                    </Text>
                  </TouchableOpacity>
                  {subcategories.map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[bmSt.chip, selectedSubId === sub.id && bmSt.chipActive]}
                      onPress={() => setSelectedSubId(sub.id)}
                    >
                      <Text style={[bmSt.chipText, selectedSubId === sub.id && bmSt.chipTextActive]}>
                        {sub.icon ? `${sub.icon} ` : ''}{sub.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* プレフィックス・サフィックス */}
            <View style={bmSt.section}>
              <Text style={bmSt.sectionLabel}>タスク名の形式</Text>
              <View style={bmSt.formatRow}>
                <View style={bmSt.inputWrap}>
                  <Text style={bmSt.inputLabel}>前置き</Text>
                  <TextInput
                    style={bmSt.input}
                    value={prefix}
                    onChangeText={setPrefix}
                    placeholder="例: 第"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={10}
                  />
                </View>
                <View style={bmSt.numberWrap}>
                  <Text style={bmSt.inputLabel}>番号</Text>
                  <View style={bmSt.numberPreview}>
                    <Text style={bmSt.numberPreviewText}>{startNum}〜{endNum}</Text>
                  </View>
                </View>
                <View style={bmSt.inputWrap}>
                  <Text style={bmSt.inputLabel}>後置き</Text>
                  <TextInput
                    style={bmSt.input}
                    value={suffix}
                    onChangeText={setSuffix}
                    placeholder="例: 回"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {/* 番号範囲 */}
            <View style={bmSt.section}>
              <Text style={bmSt.sectionLabel}>番号の範囲（最大100件）</Text>
              <View style={bmSt.rangeRow}>
                <View style={bmSt.rangeItem}>
                  <Text style={bmSt.rangeLabel}>開始</Text>
                  <Stepper
                    value={startNum}
                    min={1}
                    max={endNum}
                    onChange={(v) => setStartNum(v)}
                  />
                </View>
                <Text style={bmSt.rangeSep}>〜</Text>
                <View style={bmSt.rangeItem}>
                  <Text style={bmSt.rangeLabel}>終了</Text>
                  <Stepper
                    value={endNum}
                    min={startNum}
                    max={startNum + 99}
                    onChange={(v) => setEndNum(v)}
                  />
                </View>
              </View>
            </View>

            {/* プレビュー */}
            <View style={[bmSt.section, bmSt.previewSection]}>
              <Text style={bmSt.sectionLabel}>プレビュー（{totalCount}件）</Text>
              <Text style={bmSt.previewText}>{previewText}</Text>
            </View>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const bmSt = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  title:        { fontSize: 17, fontWeight: '700', color: COLORS.text },
  cancelBtn:    { paddingVertical: 4, paddingHorizontal: 4 },
  cancelText:   { fontSize: 15, color: COLORS.primary },
  addBtn:       { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, minWidth: 56, alignItems: 'center' },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll:       { flex: 1 },
  scrollContent:{ padding: 16, gap: 0 },

  section:      { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, padding: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceElevated },
  chipActive:   { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText:     { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary, fontWeight: '600' },

  formatRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputWrap:    { flex: 1, gap: 6 },
  inputLabel:   { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase' },
  input:        { height: 40, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background, textAlign: 'center' },
  numberWrap:   { flex: 1, gap: 6 },
  numberPreview:{ height: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.surfaceElevated },
  numberPreviewText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },

  rangeRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rangeItem:    { alignItems: 'center', gap: 8 },
  rangeLabel:   { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  rangeSep:     { fontSize: 20, color: COLORS.textMuted, fontWeight: '300', marginTop: 24 },

  previewSection: { },
  previewText:  { fontSize: 15, color: COLORS.text, lineHeight: 22 },
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CurriculumScreen() {
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const categoryId = params.categoryId ?? '';

  const {
    getCategoryById,
    fetchCategories,
    fetchCurriculumTasks,
    updateCurriculumTask,
    deleteCurriculumTask,
    addCurriculumTask,
    curriculumTasks,
    categories,
    loading,
  } = useCategoryStore();

  const [filterSubId, setFilterSubId] = useState<string | null>(null);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [isAddingTask, setIsAddingTask]         = useState(false);
  const [newTaskName, setNewTaskName]           = useState('');
  const [savingNew, setSavingNew]               = useState(false);

  // Load data
  useEffect(() => {
    if (categories.length === 0) fetchCategories();
  }, []);

  useEffect(() => {
    if (!categoryId) return;
    fetchCurriculumTasks(categoryId);
  }, [categoryId]);

  const category = getCategoryById(categoryId);
  const subcategories = category?.sub_categories ?? [];
  const tasks = (curriculumTasks[categoryId] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);

  // Filtered tasks for current chip selection
  const filteredTasks = filterSubId === null
    ? tasks
    : tasks.filter((t) => t.subcategory_id === filterSubId);

  // Grouped tasks (for "all" view group by subcategory)
  const groups: { subcat: SubCategoryRow | null; tasks: CurriculumTaskRow[] }[] = useMemo(() => {
    if (filterSubId !== null) {
      // Single group
      const sub = subcategories.find((s) => s.id === filterSubId) ?? null;
      return [{ subcat: sub, tasks: filteredTasks }];
    }

    // Group by subcategory_id
    const grouped = new Map<string | null, CurriculumTaskRow[]>();
    for (const task of tasks) {
      const key = task.subcategory_id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(task);
    }

    const result: { subcat: SubCategoryRow | null; tasks: CurriculumTaskRow[] }[] = [];
    // First: tasks with a known subcategory (in subcategory sort order)
    for (const sub of subcategories) {
      const grpTasks = grouped.get(sub.id) ?? [];
      if (grpTasks.length > 0) {
        result.push({ subcat: sub, tasks: grpTasks });
      }
    }
    // Then: tasks with null or unknown subcategory_id
    const unclassified = grouped.get(null) ?? [];
    if (unclassified.length > 0) {
      result.push({ subcat: null, tasks: unclassified });
    }

    return result;
  }, [tasks, filteredTasks, filterSubId, subcategories]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleToggle(task: CurriculumTaskRow) {
    const nowCompleted = !task.is_completed;
    const today = new Date().toISOString().slice(0, 10);
    await updateCurriculumTask(task.id, {
      is_completed:   nowCompleted,
      completed_date: nowCompleted ? today : null,
    });
  }

  async function handleDelete(id: string) {
    await deleteCurriculumTask(id, categoryId);
  }

  async function handleAddTask() {
    if (!newTaskName.trim() || !categoryId) return;
    setSavingNew(true);
    try {
      await addCurriculumTask({
        category_id:    categoryId,
        subcategory_id: filterSubId ?? null,
        name:           newTaskName.trim(),
        sort_order:     tasks.length,
        is_completed:   false,
      });
      setNewTaskName('');
      setIsAddingTask(false);
    } catch {
      Alert.alert('エラー', 'タスクの追加に失敗しました。');
    } finally {
      setSavingNew(false);
    }
  }

  async function handleBulkAdded() {
    await fetchCurriculumTasks(categoryId);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const totalCount = tasks.length;
  const doneCount  = tasks.filter((t) => t.is_completed).length;
  const headerTitle = category?.name ?? 'カリキュラム';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setBulkModalVisible(true)}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>+ 一括追加</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.root}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ---------------------------------------------------------------- */}
          {/* Header info                                                       */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>カリキュラム</Text>
            <Text style={styles.infoSub}>
              予定追加時にここから選択できます
            </Text>
          </View>

          {/* Overall progress */}
          {totalCount > 0 && (
            <View style={styles.overallProgress}>
              <View style={styles.overallProgressBg}>
                <View
                  style={[
                    styles.overallProgressFill,
                    { width: `${(doneCount / totalCount) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.overallProgressText}>
                {doneCount} / {totalCount} 完了
              </Text>
            </View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Filter chips                                                      */}
          {/* ---------------------------------------------------------------- */}
          {subcategories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterContent}
            >
              <TouchableOpacity
                style={[styles.filterChip, filterSubId === null && styles.filterChipActive]}
                onPress={() => setFilterSubId(null)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterSubId === null && styles.filterChipTextActive,
                  ]}
                >
                  すべて
                </Text>
              </TouchableOpacity>
              {subcategories.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.filterChip, filterSubId === sub.id && styles.filterChipActive]}
                  onPress={() => setFilterSubId(sub.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filterSubId === sub.id && styles.filterChipTextActive,
                    ]}
                  >
                    {sub.icon ? `${sub.icon} ` : ''}{sub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Task list                                                         */}
          {/* ---------------------------------------------------------------- */}
          {loading && tasks.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                タスクがありません。{'\n'}「+ 一括追加」か「+ タスクを追加」で登録してください。
              </Text>
            </View>
          ) : (
            groups.map((group, i) => (
              <GroupSection
                key={group.subcat?.id ?? `null-${i}`}
                subcat={group.subcat}
                tasks={group.tasks}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Add task row                                                      */}
          {/* ---------------------------------------------------------------- */}
          {isAddingTask ? (
            <View style={styles.addInputRow}>
              <TextInput
                style={styles.addInput}
                value={newTaskName}
                onChangeText={setNewTaskName}
                placeholder="タスク名を入力"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void handleAddTask()}
              />
              <TouchableOpacity
                style={[styles.addConfirmBtn, (!newTaskName.trim() || savingNew) && styles.addConfirmBtnDisabled]}
                onPress={() => void handleAddTask()}
                disabled={!newTaskName.trim() || savingNew}
              >
                {savingNew
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.addConfirmText}>追加</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addCancelBtn}
                onPress={() => { setIsAddingTask(false); setNewTaskName(''); }}
              >
                <Text style={styles.addCancelText}>×</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addTaskBtn}
              onPress={() => setIsAddingTask(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addTaskBtnText}>+ タスクを追加</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* -------------------------------------------------------------------- */}
      {/* Bulk Add Modal                                                        */}
      {/* -------------------------------------------------------------------- */}
      <BulkAddModal
        visible={bulkModalVisible}
        subcategories={subcategories}
        categoryId={categoryId}
        existingCount={tasks.length}
        onClose={() => setBulkModalVisible(false)}
        onAdded={() => void handleBulkAdded()}
      />
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingTop: 12 },

  // Header button
  headerBtn:     { paddingHorizontal: 4, paddingVertical: 4 },
  headerBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  // Info
  infoRow:   { marginBottom: 12 },
  infoTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  infoSub:   { fontSize: 13, color: COLORS.textMuted },

  // Overall progress
  overallProgress: { marginBottom: 16, gap: 6 },
  overallProgressBg:   { height: 6, backgroundColor: COLORS.border, borderRadius: 3 },
  overallProgressFill: { height: 6, backgroundColor: COLORS.success, borderRadius: 3 },
  overallProgressText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  // Filter chips
  filterScroll:  { marginBottom: 16, marginHorizontal: -16 },
  filterContent: { paddingHorizontal: 16, flexDirection: 'row', gap: 8 },
  filterChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  filterChipActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  filterChipText:      { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  filterChipTextActive:{ color: COLORS.primary, fontWeight: '600' },

  // Loading / Empty
  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  emptyWrap:   { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

  // Add task button (dashed border)
  addTaskBtn: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  addTaskBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },

  // Inline add input row
  addInputRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: COLORS.surface, borderRadius: 12, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
  addInput:       { flex: 1, height: 38, fontSize: 15, color: COLORS.text },
  addConfirmBtn:  { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addConfirmBtnDisabled: { opacity: 0.4 },
  addConfirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  addCancelBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  addCancelText:  { fontSize: 18, color: COLORS.textMuted, lineHeight: 22 },
});
