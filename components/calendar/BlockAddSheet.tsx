/**
 * BlockAddSheet — 予定ブロック追加ボトムシート
 *
 * 使い方:
 *   <BlockAddSheet
 *     visible={!!addSheet}
 *     onClose={() => setAddSheet(null)}
 *     date={selectedDate}
 *     initialStartTime={addSheet?.startTime}
 *     initialEndTime={addSheet?.endTime}
 *   />
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useUserSettingsStore } from '@/stores/useUserSettingsStore';
import { scheduleSessionReminder, cancelNotification } from '@/lib/notifications';
import { TimeWheel } from '@/components/common/WheelPicker';
import { POMODORO_DEFAULTS } from '@/constants/defaults';
import type { BlockType, BlockWithDetails, CategoryType, TimerMode } from '@/types/database';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const { height: SCREEN_H } = Dimensions.get('window');

const TYPE_CONFIG: {
  key: BlockType;
  label: string;
  icon: string;
  color: string;
  catType: CategoryType | null;
}[] = [
  { key: 'study',    label: '学習', icon: '📚', color: '#7c3aed', catType: 'study' },
  { key: 'exercise', label: '運動', icon: '🏋️', color: '#65a30d', catType: 'exercise' },
  { key: 'life',     label: '生活', icon: '🏠', color: '#475569', catType: 'life' },
  { key: 'rest',     label: '休憩', icon: '☕', color: '#0891b2', catType: null },
];

const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: '5分前',   value: 5 },
  { label: '10分前',  value: 10 },
  { label: '15分前',  value: 15 },
  { label: '30分前',  value: 30 },
  { label: '1時間前', value: 60 },
  { label: 'なし',    value: null },
];

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toStr(minutes: number): string {
  const clamped = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

function pomodoroTotal(
  count: number,
  focusMin: number,
  breakMin: number,
): number {
  return focusMin * count + breakMin * (count - 1);
}

function formatPomodoroLabel(
  count: number,
  focusMin: number,
  breakMin: number,
): string {
  const total = pomodoroTotal(count, focusMin, breakMin);
  const totalStr = formatDuration(total);
  if (count === 1) {
    return `= ${totalStr}（${focusMin}分×1）`;
  }
  return `= ${totalStr}（${focusMin}分×${count} + 休憩${breakMin * (count - 1)}分）`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BlockAddSheetProps {
  visible: boolean;
  onClose: () => void;
  date: string;              // YYYY-MM-DD
  initialStartTime?: string; // "HH:MM"
  initialEndTime?: string;   // "HH:MM"
  /** 'add'=新規(デフォルト), 'edit'=直接編集, 'ghost'=当日変更（ゴースト化） */
  mode?: 'add' | 'edit' | 'ghost';
  /** edit/ghost モード時: 元ブロックのデータ（フォームの初期値として使用） */
  presetBlock?: BlockWithDetails;
  /** edit モード: 更新するブロックID */
  editBlockId?: string;
  /** ghost モード: ゴースト化する元ブロックID */
  originalBlockId?: string;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function BlockAddSheet({
  visible,
  onClose,
  date,
  initialStartTime,
  initialEndTime,
  mode = 'add',
  presetBlock,
  editBlockId,
  originalBlockId,
}: BlockAddSheetProps) {
  // ── ストア ──────────────────────────────────────────────────────────────
  const { addBlock, updateBlock, updateBlockWithGhost } = useCalendarStore();
  const {
    categories,
    curriculumTasks,
    fetchCategories,
    fetchCurriculumTasks,
    getCategoryById,
    getCategoriesByType,
    getActiveSubcategories,
  } = useCategoryStore();
  const { settings } = useUserSettingsStore();

  const focusMin = settings?.pomodoro_focus_minutes ?? POMODORO_DEFAULTS.focusMinutes;
  const breakMin = settings?.pomodoro_short_break   ?? POMODORO_DEFAULTS.shortBreakMinutes;

  // ── フォーム状態 ─────────────────────────────────────────────────────────
  const [blockType,        setBlockType]        = useState<BlockType>('study');
  const [categoryId,       setCategoryId]       = useState<string | null>(null);
  const [subcategoryId,    setSubcategoryId]    = useState<string | null>(null);
  const [curriculumTaskId, setCurriculumTaskId] = useState<string | null>(null);
  const [timerMode,        setTimerMode]        = useState<TimerMode>('pomodoro');
  const [pomodoroCount,    setPomodoroCount]    = useState(1);
  const [startTime,        setStartTime]        = useState('09:00');
  const [endTime,          setEndTime]          = useState('09:25');
  const [memo,             setMemo]             = useState('');
  const [reminderMinutes,  setReminderMinutes]  = useState<number | null>(
    settings?.default_reminder_minutes ?? 10,
  );
  const [showCurriculum, setShowCurriculum] = useState(false);
  const [saving,         setSaving]         = useState(false);

  // 時刻ピッカー
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | null>(null);
  const [pickerTime,       setPickerTime]       = useState('09:00');

  // ── 派生値 ───────────────────────────────────────────────────────────────
  const typeConfig      = TYPE_CONFIG.find((t) => t.key === blockType)!;
  const typeColor       = typeConfig.color;
  const selectedCategory = categoryId ? getCategoryById(categoryId) : null;
  const activeSubcats   = categoryId ? getActiveSubcategories(categoryId) : [];
  const incompleteTasks = categoryId
    ? (curriculumTasks[categoryId] ?? []).filter((t) => !t.is_completed)
    : [];
  const selectedTask = incompleteTasks.find((t) => t.id === curriculumTaskId);

  const durationMin = toMin(endTime) - toMin(startTime);
  const isTimeValid = durationMin > 0;
  const canSubmit   = isTimeValid && (blockType === 'rest' || categoryId !== null);

  const pomodoroEndTime = useCallback(
    (start: string, count: number) =>
      toStr(toMin(start) + pomodoroTotal(count, focusMin, breakMin)),
    [focusMin, breakMin],
  );

  // ── 初期化（シート開閉） ─────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    if (presetBlock && (mode === 'edit' || mode === 'ghost')) {
      // edit/ghost: 元ブロックのデータをフォームに反映
      setBlockType(presetBlock.block_type);
      setCategoryId(presetBlock.category_id);
      setSubcategoryId(presetBlock.subcategory_id);
      setCurriculumTaskId(presetBlock.curriculum_task_id);
      setTimerMode(presetBlock.timer_mode);
      setPomodoroCount(presetBlock.pomodoro_count ?? 1);
      const s = presetBlock.start_time.slice(0, 5);
      const e = presetBlock.end_time.slice(0, 5);
      setStartTime(s);
      setEndTime(e);
      setMemo(presetBlock.memo ?? '');
      setReminderMinutes(presetBlock.reminder_minutes ?? settings?.default_reminder_minutes ?? 10);
      setShowCurriculum(false);
    } else {
      // add: フォームリセット
      setBlockType('study');
      setCategoryId(null);
      setSubcategoryId(null);
      setCurriculumTaskId(null);
      setTimerMode('pomodoro');
      setPomodoroCount(1);
      setMemo('');
      setReminderMinutes(settings?.default_reminder_minutes ?? 10);
      setShowCurriculum(false);

      const s = initialStartTime ?? '09:00';
      setStartTime(s);
      setEndTime(pomodoroEndTime(s, 1));
    }

    // カテゴリ未取得なら取得
    if (categories.length === 0) fetchCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── カテゴリ変更 ─────────────────────────────────────────────────────────
  useEffect(() => {
    setSubcategoryId(null);
    setCurriculumTaskId(null);
    setShowCurriculum(false);

    if (categoryId && selectedCategory?.has_curriculum) {
      if (!curriculumTasks[categoryId]) {
        fetchCurriculumTasks(categoryId);
      }
    }
  }, [categoryId]);

  // ── 種別変更 ─────────────────────────────────────────────────────────────
  const handleBlockTypeChange = (type: BlockType) => {
    setBlockType(type);
    setCategoryId(null);
    setSubcategoryId(null);
    setCurriculumTaskId(null);
    // 学習以外はポモドーロ不可
    if (type !== 'study') {
      setTimerMode('countdown');
    } else {
      setTimerMode('pomodoro');
    }
  };

  // ── ポモドーロ回数変更 ───────────────────────────────────────────────────
  const handlePomodoroCountChange = (delta: number) => {
    const next = Math.min(Math.max(pomodoroCount + delta, 1), 10);
    setPomodoroCount(next);
    setEndTime(pomodoroEndTime(startTime, next));
  };

  // ── 計測方法切替 ─────────────────────────────────────────────────────────
  const handleTimerModeChange = (mode: TimerMode) => {
    setTimerMode(mode);
    if (mode === 'pomodoro') {
      setEndTime(pomodoroEndTime(startTime, pomodoroCount));
    }
  };

  // ── 時刻ピッカー ─────────────────────────────────────────────────────────
  const openTimePicker = (which: 'start' | 'end') => {
    setPickerTime(which === 'start' ? startTime : endTime);
    setActiveTimePicker(which);
  };

  const confirmTimePicker = useCallback(() => {
    if (activeTimePicker === 'start') {
      const delta = toMin(pickerTime) - toMin(startTime);
      setStartTime(pickerTime);
      if (timerMode === 'pomodoro') {
        setEndTime(pomodoroEndTime(pickerTime, pomodoroCount));
      } else {
        // 持続時間を保ったまま終了時刻をシフト
        setEndTime(toStr(toMin(endTime) + delta));
      }
    } else {
      setEndTime(pickerTime);
    }
    setActiveTimePicker(null);
  }, [activeTimePicker, pickerTime, startTime, endTime, timerMode, pomodoroCount, pomodoroEndTime]);

  // ── PanResponder（ハンドルスワイプで閉じる） ──────────────────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, s) => s.dy > 8,
        onPanResponderRelease: (_, s) => {
          if (s.dy > 80 || s.vy > 0.8) onClose();
        },
      }),
    [onClose],
  );

  // ── 追加 / 編集 / ゴースト化 ────────────────────────────────────────────
  const handleAdd = async () => {
    if (!canSubmit) return;
    setSaving(true);

    const blockData = {
      date,
      start_time: startTime,
      end_time:   endTime,
      block_type: blockType,
      category_id:        categoryId,
      subcategory_id:     subcategoryId,
      curriculum_task_id: curriculumTaskId,
      timer_mode:    timerMode,
      pomodoro_count: timerMode === 'pomodoro' ? pomodoroCount : null,
      memo:            memo.trim() || null,
      reminder_minutes: reminderMinutes,
      status:          'planned' as const,
    };

    try {
      let block;
      if (mode === 'ghost' && originalBlockId) {
        block = await updateBlockWithGhost(originalBlockId, blockData);
      } else if (mode === 'edit' && editBlockId) {
        await updateBlock(editBlockId, blockData);
        block = null; // updateBlock returns void
      } else {
        block = await addBlock(blockData);
      }

      // ローカル通知スケジュール
      try {
        // 編集・ゴースト化の場合は既存通知をキャンセル
        if (mode === 'edit' && editBlockId) {
          await cancelNotification(editBlockId);
        } else if (mode === 'ghost' && originalBlockId) {
          await cancelNotification(originalBlockId);
        }

        // 新規ブロックに通知を登録
        if (block && reminderMinutes !== null && reminderMinutes > 0) {
          await scheduleSessionReminder(block, reminderMinutes);
        }
      } catch {
        // 通知エラーは無視（許可が得られていない場合など）
      }

      onClose();
    } catch (e) {
      console.error('[BlockAddSheet] handleAdd error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── レンダリング ─────────────────────────────────────────────────────────

  const catList = typeConfig.catType
    ? getCategoriesByType(typeConfig.catType)
    : [];

  return (
    <>
      {/* ── ボトムシート Modal ── */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* 背景タップで閉じる */}
          <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

          {/* シート本体 */}
          <View style={styles.sheet}>
            {/* ハンドル */}
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handleBar} />
            </View>

            {/* タイトル */}
            <Text style={styles.sheetTitle}>
              {mode === 'ghost' ? '予定を変更（当日）' : mode === 'edit' ? '予定ブロックを編集' : '予定ブロックを追加'}
            </Text>

            {/* スクロールコンテンツ */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ─── 1. 種別選択 ─── */}
              <Text style={styles.sectionLabel}>種別</Text>
              <View style={styles.typeRow}>
                {TYPE_CONFIG.map((t) => {
                  const active = blockType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.typeBtn,
                        active && { borderColor: t.color, backgroundColor: `${t.color}14` },
                      ]}
                      onPress={() => handleBlockTypeChange(t.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.typeBtnIcon}>{t.icon}</Text>
                      <Text style={[styles.typeBtnLabel, active && { color: t.color, fontWeight: '700' }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ─── 2. 科目/種目選択 ─── */}
              {blockType !== 'rest' && catList.length > 0 && (
                <>
                  <Divider />
                  <Text style={styles.sectionLabel}>
                    {blockType === 'study' ? '科目' : blockType === 'exercise' ? '種目' : 'カテゴリ'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {catList.map((cat) => {
                      const active = categoryId === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.chip,
                            active
                              ? { backgroundColor: cat.color, borderColor: cat.color }
                              : styles.chipInactive,
                          ]}
                          onPress={() => setCategoryId(active ? null : cat.id)}
                        >
                          {cat.icon && (
                            <Text style={styles.chipIcon}>{cat.icon}</Text>
                          )}
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {/* ─── 3. 内訳選択 ─── */}
              {activeSubcats.length > 0 && (
                <>
                  <Divider />
                  <Text style={styles.sectionLabel}>内訳</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    {activeSubcats.map((sub) => {
                      const active = subcategoryId === sub.id;
                      const color  = selectedCategory?.color ?? '#94a3b8';
                      return (
                        <TouchableOpacity
                          key={sub.id}
                          style={[
                            styles.chip,
                            active
                              ? { backgroundColor: color, borderColor: color }
                              : styles.chipInactive,
                          ]}
                          onPress={() => setSubcategoryId(active ? null : sub.id)}
                        >
                          {sub.icon && (
                            <Text style={styles.chipIcon}>{sub.icon}</Text>
                          )}
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {sub.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {/* ─── 4. カリキュラム選択 ─── */}
              {selectedCategory?.has_curriculum && (
                <>
                  <Divider />
                  <TouchableOpacity
                    style={styles.curriculumHeader}
                    onPress={() => setShowCurriculum((v) => !v)}
                  >
                    <Text style={styles.sectionLabel}>📋 カリキュラムから選択</Text>
                    <Text style={styles.expandIcon}>
                      {showCurriculum ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>

                  {curriculumTaskId && selectedTask && (
                    <View style={styles.selectedTask}>
                      <Text style={styles.selectedTaskText}>✓ {selectedTask.name}</Text>
                      <TouchableOpacity onPress={() => setCurriculumTaskId(null)}>
                        <Text style={styles.clearTask}>×</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {showCurriculum && (
                    <View style={styles.taskList}>
                      {incompleteTasks.length === 0 ? (
                        <Text style={styles.emptyTasks}>未完了のタスクはありません</Text>
                      ) : (
                        incompleteTasks.map((task) => (
                          <TouchableOpacity
                            key={task.id}
                            style={[
                              styles.taskItem,
                              curriculumTaskId === task.id && styles.taskItemActive,
                            ]}
                            onPress={() => {
                              setCurriculumTaskId(task.id);
                              setShowCurriculum(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.taskItemText,
                                curriculumTaskId === task.id && { color: typeColor },
                              ]}
                            >
                              {task.name}
                            </Text>
                            {curriculumTaskId === task.id && (
                              <Text style={{ color: typeColor }}>✓</Text>
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </>
              )}

              {/* ─── 5. 計測方法 ─── */}
              <Divider />
              <Text style={styles.sectionLabel}>計測方法</Text>
              <View style={styles.timerToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.timerToggleBtn,
                    timerMode === 'pomodoro' && { backgroundColor: typeColor, borderColor: typeColor },
                    blockType !== 'study' && styles.timerToggleBtnDisabled,
                  ]}
                  onPress={() => blockType === 'study' && handleTimerModeChange('pomodoro')}
                  disabled={blockType !== 'study'}
                >
                  <Text style={[
                    styles.timerToggleText,
                    timerMode === 'pomodoro' && styles.timerToggleTextActive,
                    blockType !== 'study' && styles.timerToggleTextDisabled,
                  ]}>
                    🍅 ポモドーロ
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.timerToggleBtn,
                    timerMode === 'countdown' && { backgroundColor: typeColor, borderColor: typeColor },
                  ]}
                  onPress={() => handleTimerModeChange('countdown')}
                >
                  <Text style={[
                    styles.timerToggleText,
                    timerMode === 'countdown' && styles.timerToggleTextActive,
                  ]}>
                    ⏱ 時間指定
                  </Text>
                </TouchableOpacity>
              </View>
              {blockType !== 'study' && (
                <Text style={styles.timerNote}>
                  {blockType === 'exercise' ? '運動' : blockType === 'life' ? '生活' : '休憩'}は時間指定のみ対応しています
                </Text>
              )}

              {/* ─── 6a. ポモドーロ設定 ─── */}
              {timerMode === 'pomodoro' && (
                <>
                  <Divider />
                  <Text style={styles.sectionLabel}>回数</Text>

                  {/* ステッパー */}
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handlePomodoroCountChange(-1)}
                      disabled={pomodoroCount <= 1}
                    >
                      <Text style={[styles.stepperBtnText, pomodoroCount <= 1 && styles.stepperBtnDisabled]}>
                        −
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.stepperValue}>
                      <Text style={[styles.stepperCount, { color: typeColor }]}>{pomodoroCount}</Text>
                      <Text style={styles.stepperUnit}>セット</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handlePomodoroCountChange(1)}
                      disabled={pomodoroCount >= 10}
                    >
                      <Text style={[styles.stepperBtnText, pomodoroCount >= 10 && styles.stepperBtnDisabled]}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.pomodoroCalc}>
                    {formatPomodoroLabel(pomodoroCount, focusMin, breakMin)}
                  </Text>

                  {/* 開始時刻 + 自動算出終了時刻 */}
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeFieldLabel}>開始</Text>
                      <TouchableOpacity
                        style={styles.timeBtn}
                        onPress={() => openTimePicker('start')}
                      >
                        <Text style={[styles.timeBtnText, { color: typeColor }]}>{startTime}</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.timeSeparator}>→</Text>

                    <View style={styles.timeField}>
                      <Text style={styles.timeFieldLabel}>終了（自動）</Text>
                      <View style={[styles.timeBtn, styles.timeBtnAuto]}>
                        <Text style={styles.timeBtnTextMuted}>{endTime}</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}

              {/* ─── 6b. 時間指定設定 ─── */}
              {timerMode === 'countdown' && (
                <>
                  <Divider />
                  <Text style={styles.sectionLabel}>時刻</Text>

                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeFieldLabel}>開始</Text>
                      <TouchableOpacity
                        style={styles.timeBtn}
                        onPress={() => openTimePicker('start')}
                      >
                        <Text style={[styles.timeBtnText, { color: typeColor }]}>{startTime}</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.timeSeparator}>→</Text>

                    <View style={styles.timeField}>
                      <Text style={styles.timeFieldLabel}>終了</Text>
                      <TouchableOpacity
                        style={styles.timeBtn}
                        onPress={() => openTimePicker('end')}
                      >
                        <Text style={[
                          styles.timeBtnText,
                          { color: typeColor },
                          !isTimeValid && styles.timeBtnTextError,
                        ]}>
                          {endTime}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {isTimeValid ? (
                    <Text style={styles.durationLabel}>
                      所要時間: {formatDuration(durationMin)}
                    </Text>
                  ) : (
                    <Text style={styles.durationError}>
                      終了時刻は開始時刻より後にしてください
                    </Text>
                  )}
                </>
              )}

              {/* ─── 7. メモ ─── */}
              <Divider />
              <Text style={styles.sectionLabel}>メモ（任意）</Text>
              <TextInput
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="メモを入力..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={2}
                maxLength={200}
              />

              {/* ─── 8. リマインド ─── */}
              <Divider />
              <Text style={styles.sectionLabel}>🔔 リマインド通知</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {REMINDER_OPTIONS.map((opt) => {
                  const active = reminderMinutes === opt.value;
                  return (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[
                        styles.chip,
                        active
                          ? { backgroundColor: typeColor, borderColor: typeColor }
                          : styles.chipInactive,
                      ]}
                      onPress={() => setReminderMinutes(opt.value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 下部余白 */}
              <View style={{ height: 8 }} />
            </ScrollView>

            {/* ─── フッター：追加ボタン ─── */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  { backgroundColor: canSubmit ? typeColor : '#94a3b8' },
                ]}
                onPress={handleAdd}
                disabled={!canSubmit || saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.addBtnText}>
                    {mode === 'ghost' ? '変更する' : mode === 'edit' ? '保存する' : '追加する'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 時刻ピッカー Modal ── */}
      {activeTimePicker && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveTimePicker(null)}
          statusBarTranslucent
        >
          <TouchableOpacity
            style={styles.timePickerOverlay}
            onPress={() => setActiveTimePicker(null)}
            activeOpacity={1}
          >
            <TouchableOpacity
              style={styles.timePickerCard}
              activeOpacity={1}
              onPress={() => {}}
            >
              <Text style={styles.timePickerTitle}>
                {activeTimePicker === 'start' ? '開始時刻' : '終了時刻'}を選択
              </Text>

              <TimeWheel value={pickerTime} onChange={setPickerTime} />

              <View style={styles.timePickerActions}>
                <TouchableOpacity
                  style={styles.timePickerCancel}
                  onPress={() => setActiveTimePicker(null)}
                >
                  <Text style={styles.timePickerCancelText}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timePickerConfirm, { backgroundColor: typeColor }]}
                  onPress={confirmTimePicker}
                >
                  <Text style={styles.timePickerConfirmText}>確定</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// 補助コンポーネント
// ---------------------------------------------------------------------------

function Divider() {
  return <View style={divStyles.line} />;
}

const divStyles = StyleSheet.create({
  line: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
});

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // オーバーレイ
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // シート
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_H * 0.92,
    paddingBottom: Platform.OS === 'ios' ? 34 : 0, // safe area
  },

  // ハンドル
  handleArea: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
  },

  // タイトル
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  // スクロール
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // セクションラベル
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // 種別ボタン
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 4,
  },
  typeBtnIcon: {
    fontSize: 20,
  },
  typeBtnLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },

  // チップ
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  chipInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // カリキュラム
  curriculumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandIcon: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
  },
  selectedTask: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  selectedTaskText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },
  clearTask: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  taskList: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    justifyContent: 'space-between',
  },
  taskItemActive: {
    backgroundColor: '#f5f3ff',
  },
  taskItemText: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  emptyTasks: {
    textAlign: 'center',
    padding: 16,
    fontSize: 13,
    color: '#94a3b8',
  },

  // タイマートグル
  timerToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timerToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  timerToggleBtnDisabled: {
    opacity: 0.4,
  },
  timerToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  timerToggleTextActive: {
    color: '#fff',
  },
  timerToggleTextDisabled: {
    color: '#94a3b8',
  },
  timerNote: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },

  // ポモドーロステッパー
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginVertical: 8,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 22,
    color: '#1e293b',
    lineHeight: 26,
  },
  stepperBtnDisabled: {
    color: '#cbd5e1',
  },
  stepperValue: {
    alignItems: 'center',
    gap: 2,
  },
  stepperCount: {
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 50,
  },
  stepperUnit: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  pomodoroCalc: {
    textAlign: 'center',
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
  },

  // 時刻入力
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
  },
  timeField: {
    alignItems: 'center',
    gap: 4,
  },
  timeFieldLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  timeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    minWidth: 90,
    alignItems: 'center',
  },
  timeBtnAuto: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  timeBtnText: {
    fontSize: 22,
    fontWeight: '700',
  },
  timeBtnTextMuted: {
    fontSize: 22,
    fontWeight: '700',
    color: '#94a3b8',
  },
  timeBtnTextError: {
    color: '#dc2626',
  },
  timeSeparator: {
    fontSize: 18,
    color: '#94a3b8',
    marginBottom: 14,
  },
  durationLabel: {
    textAlign: 'center',
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
  },
  durationError: {
    textAlign: 'center',
    fontSize: 12,
    color: '#dc2626',
    marginTop: 8,
  },

  // メモ
  memoInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    textAlignVertical: 'top',
    minHeight: 64,
    backgroundColor: '#f8fafc',
  },

  // フッター
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  addBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // 時刻ピッカー
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  timePickerCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  timePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  timePickerCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  timePickerConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  timePickerConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
