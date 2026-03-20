import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useTimerStore } from '@/stores/useTimerStore';
import type { ActiveBlockInfo } from '@/stores/useTimerStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import type { BlockWithDetails } from '@/types/database';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const BG          = '#0f172a';
const CYAN        = '#22d3ee';
const ORANGE      = '#fb923c';
const RING_SIZE   = 190;
const RING_STROKE = 10;
const RING_TRACK  = 'rgba(255,255,255,0.06)';

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function formatTime(secs: number): string {
  const abs = Math.max(secs, 0);
  const m   = Math.floor(abs / 60);
  const s   = abs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex?.startsWith('#') || hex.length < 7) return `rgba(148,163,184,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// TimerRing — 190x190 リングプログレス（純粋 React Native 実装）
//
// percent: 100 = フル → 0 = 空 (残り時間ドレイン方式)
// ---------------------------------------------------------------------------

function TimerRing({
  percent,
  color,
  size = RING_SIZE,
  strokeWidth = RING_STROKE,
  children,
}: {
  percent: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const r       = size / 2;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const angle   = (clamped / 100) * 360;

  const rightDeg = Math.min(angle, 180) - 180;
  const leftDeg  = Math.max(angle - 180, 0) - 180;

  const ring = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: r,
    borderWidth: strokeWidth,
    borderColor: color,
  };

  return (
    <View style={{ width: size, height: size }}>
      <View style={{ ...ring, borderColor: RING_TRACK }} />

      <View style={{ position: 'absolute', right: 0, width: r, height: size, overflow: 'hidden' }}>
        <View style={{ ...ring, right: 0, transform: [{ rotate: `${rightDeg}deg` }] }} />
      </View>

      <View style={{ position: 'absolute', left: 0, width: r, height: size, overflow: 'hidden' }}>
        <View style={{ ...ring, left: 0, transform: [{ rotate: `${leftDeg}deg` }] }} />
      </View>

      <View
        style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}
        pointerEvents="none"
      >
        {children}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SessionDot
// ---------------------------------------------------------------------------

function SessionDot({ index, currentIndex }: { index: number; currentIndex: number }) {
  const isCompleted = index < currentIndex;
  const isCurrent   = index === currentIndex;

  return (
    <View style={[dotSt.dot, isCompleted && dotSt.completed, isCurrent && dotSt.current]}>
      <Text style={[dotSt.num, (isCompleted || isCurrent) && dotSt.numActive]}>
        {index + 1}
      </Text>
    </View>
  );
}

const dotSt = StyleSheet.create({
  dot: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  completed: { backgroundColor: CYAN, borderColor: CYAN, borderStyle: 'solid' },
  current:   { backgroundColor: 'rgba(34,211,238,0.2)', borderColor: CYAN, borderStyle: 'solid' },
  num:       { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.25)' },
  numActive: { color: '#fff' },
});

// ---------------------------------------------------------------------------
// BlockPickerRow
// ---------------------------------------------------------------------------

function BlockPickerRow({ block, onPress }: { block: BlockWithDetails; onPress: () => void }) {
  const color  = block.activity_categories?.color ?? '#94a3b8';
  const name   = block.activity_categories?.name  ?? 'ブロック';
  const isDone = block.status === 'completed' || block.status === 'skipped';

  return (
    <TouchableOpacity
      style={[pickSt.row, { backgroundColor: hexToRgba(color, 0.1), opacity: isDone ? 0.45 : 1 }]}
      onPress={onPress}
      disabled={isDone}
      activeOpacity={0.75}
    >
      <View style={[pickSt.bar, { backgroundColor: color }]} />

      <View style={pickSt.info}>
        <View style={pickSt.titleRow}>
          <Text style={[pickSt.name, { color }]} numberOfLines={1}>{name}</Text>
          <Text style={pickSt.time}>
            {block.start_time.slice(0, 5)} - {block.end_time.slice(0, 5)}
          </Text>
        </View>
        {block.sub_categories && (
          <Text style={pickSt.sub} numberOfLines={1}>
            {block.sub_categories.icon} {block.sub_categories.name}
          </Text>
        )}
        {block.timer_mode === 'pomodoro' && block.pomodoro_count && (
          <Text style={pickSt.meta}>🍅 × {block.pomodoro_count}</Text>
        )}
        {block.timer_mode === 'countdown' && (
          <Text style={pickSt.meta}>
            ⏱ {toMin(block.end_time) - toMin(block.start_time)}分
          </Text>
        )}
      </View>

      {isDone ? (
        <Text style={pickSt.doneBadge}>済</Text>
      ) : block.status === 'in_progress' ? (
        <Text style={pickSt.activeBadge}>進行中</Text>
      ) : (
        <Text style={pickSt.startIcon}>▶</Text>
      )}
    </TouchableOpacity>
  );
}

const pickSt = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  bar:      { width: 4, alignSelf: 'stretch', marginRight: 14 },
  info:     { flex: 1, paddingVertical: 14, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:     { flex: 1, fontSize: 15, fontWeight: '700' },
  time:     { fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 },
  sub:      { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  meta:     { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  doneBadge:  { fontSize: 12, fontWeight: '700', color: '#4ade80', paddingRight: 16 },
  activeBadge:{ fontSize: 11, fontWeight: '700', color: CYAN, paddingRight: 12 },
  startIcon:  { fontSize: 16, color: 'rgba(255,255,255,0.4)', paddingRight: 16 },
});

// ---------------------------------------------------------------------------
// 共通: 科目バッジ + 内訳ラベル
// ---------------------------------------------------------------------------

function SubjectArea({
  categoryColor,
  categoryName,
  subIcon,
  subName,
  curriculumName,
}: {
  categoryColor: string;
  categoryName: string;
  subIcon: string;
  subName: string;
  curriculumName: string;
}) {
  return (
    <View style={styles.topArea}>
      {categoryName !== '' && (
        <View
          style={[
            styles.subjectBadge,
            {
              backgroundColor: hexToRgba(categoryColor, 0.18),
              borderColor:     hexToRgba(categoryColor, 0.5),
            },
          ]}
        >
          <Text style={[styles.subjectText, { color: categoryColor }]}>
            {categoryName}
          </Text>
        </View>
      )}
      {(subName || curriculumName) && (
        <Text style={styles.subLabel}>
          {subIcon ? `${subIcon} ` : ''}{subName}
          {subName && curriculumName ? ' ・ ' : ''}
          {curriculumName}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 共通: 次の予定カード + 中断ボタン
// ---------------------------------------------------------------------------

function BottomArea({
  nextBlock,
  onInterrupt,
}: {
  nextBlock: BlockWithDetails | null;
  onInterrupt: () => void;
}) {
  return (
    <>
      {nextBlock && (
        <View style={styles.nextCard}>
          <Text style={styles.nextPrefix}>次:</Text>
          <Text
            style={[styles.nextName, { color: nextBlock.activity_categories?.color ?? CYAN }]}
            numberOfLines={1}
          >
            {nextBlock.activity_categories?.name ?? 'ブロック'}
          </Text>
          {nextBlock.sub_categories && (
            <Text style={styles.nextSub} numberOfLines={1}>
              {nextBlock.sub_categories.icon} {nextBlock.sub_categories.name}
            </Text>
          )}
          <Text style={styles.nextTime}>{nextBlock.start_time.slice(0, 5)}</Text>
        </View>
      )}
      <TouchableOpacity style={styles.interruptBtn} onPress={onInterrupt}>
        <Text style={styles.interruptText}>中断する</Text>
      </TouchableOpacity>
    </>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function TimerScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // ── Timer Store ──────────────────────────────────────────────────────────

  const {
    mode,
    phase,
    isRunning,
    secondsRemaining,
    currentSession,
    totalSessions,
    focusSeconds,
    shortBreakSeconds,
    longBreakSeconds,
    activeBlock,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    interruptPomodoro,
    startCountdown,
    pauseCountdown,
    resumeCountdown,
    interruptCountdown,
    adjustAfterBackground,
  } = useTimerStore();

  // ── Calendar Store ───────────────────────────────────────────────────────

  const { getBlocksForDate, fetchBlocksForDate } = useCalendarStore();
  const blocks = getBlocksForDate(todayStr);

  // ── Local State ──────────────────────────────────────────────────────────

  const [blockDetails, setBlockDetails] = useState<BlockWithDetails | null>(null);
  const notifIdRef = useRef<string | null>(null);
  const bgAtRef    = useRef<number | null>(null);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchBlocksForDate(todayStr);
  }, [todayStr]);

  useEffect(() => {
    if (activeBlock) {
      const found = getBlocksForDate(todayStr).find((b) => b.id === activeBlock.id);
      if (found) setBlockDetails(found);
    } else {
      setBlockDetails(null);
    }
  }, [activeBlock?.id]);

  // AppState: バックグラウンド復帰後の時間補正
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        bgAtRef.current = Date.now();
      } else if (state === 'active' && bgAtRef.current !== null) {
        const elapsed = Math.floor((Date.now() - bgAtRef.current) / 1000);
        adjustAfterBackground(elapsed);
        bgAtRef.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  // ポモドーロ: フォーカスフェーズ開始時に通知をスケジュール
  useEffect(() => {
    if (mode === 'pomodoro' && phase === 'focus' && isRunning) {
      void scheduleFocusNotif(secondsRemaining);
    } else {
      void cancelFocusNotif();
    }
  }, [mode, phase, isRunning, currentSession]);

  // ── 通知 ─────────────────────────────────────────────────────────────────

  async function scheduleFocusNotif(secs: number) {
    await cancelFocusNotif();
    try {
      const shortMin = Math.round(shortBreakSeconds / 60);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '集中タイム終了！',
          body: `お疲れ様でした。${shortMin}分間休憩しましょう。`,
        },
        trigger: { seconds: secs, repeats: false } as any,
      });
      notifIdRef.current = id;
    } catch { /* ignore */ }
  }

  async function cancelFocusNotif() {
    if (notifIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notifIdRef.current);
      } catch { /* ignore */ }
      notifIdRef.current = null;
    }
  }

  // ── ハンドラ ──────────────────────────────────────────────────────────────

  async function handleSelectBlock(block: BlockWithDetails) {
    setBlockDetails(block);

    const info: ActiveBlockInfo = {
      id:                 block.id,
      categoryId:         block.category_id,
      subcategoryId:      block.subcategory_id,
      curriculumTaskId:   block.curriculum_task_id,
      timerMode:          block.timer_mode,
      pomodoroCount:      block.pomodoro_count ?? 1,
      plannedDurationSec: (toMin(block.end_time) - toMin(block.start_time)) * 60,
    };

    try {
      if (block.timer_mode === 'countdown') {
        await startCountdown(info);
      } else {
        await startPomodoro(info);
      }
    } catch {
      Alert.alert('エラー', 'タイマーの開始に失敗しました。');
      setBlockDetails(null);
    }
  }

  function handleTogglePause() {
    if (mode === 'countdown') {
      if (isRunning) {
        pauseCountdown();
      } else {
        resumeCountdown();
      }
    } else {
      if (isRunning) {
        pausePomodoro();
        void cancelFocusNotif();
      } else {
        resumePomodoro();
        if (phase === 'focus') void scheduleFocusNotif(secondsRemaining);
      }
    }
  }

  function handleInterrupt() {
    Alert.alert(
      'タイマーを中断しますか？',
      '現在のセッションの記録は保存されます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '中断する',
          style: 'destructive',
          onPress: async () => {
            await cancelFocusNotif();
            if (mode === 'countdown') {
              await interruptCountdown('user_interrupted');
            } else {
              await interruptPomodoro('user_interrupted');
            }
            setBlockDetails(null);
          },
        },
      ],
    );
  }

  // ── 派生値 ────────────────────────────────────────────────────────────────

  const categoryColor  = blockDetails?.activity_categories?.color ?? CYAN;
  const categoryName   = blockDetails?.activity_categories?.name  ?? '';
  const subIcon        = blockDetails?.sub_categories?.icon       ?? '';
  const subName        = blockDetails?.sub_categories?.name       ?? '';
  const curriculumName = blockDetails?.curriculum_tasks?.name     ?? '';

  // 次の未完了ブロック（アクティブブロックの終了時刻以降）
  const nextBlock = (() => {
    if (!blockDetails) return null;
    const endMin = toMin(blockDetails.end_time);
    return (
      blocks.find(
        (b) =>
          b.id !== blockDetails.id &&
          b.status !== 'completed' &&
          b.status !== 'skipped' &&
          toMin(b.start_time) >= endMin,
      ) ?? null
    );
  })();

  // ポモドーロ用
  const phaseTotalSec = phase === 'focus'
    ? focusSeconds
    : phase === 'longBreak'
    ? longBreakSeconds
    : shortBreakSeconds;

  const pomodoroRingPercent = phaseTotalSec > 0
    ? Math.round((secondsRemaining / phaseTotalSec) * 100)
    : 0;

  const phaseColor = phase === 'focus'
    ? CYAN
    : phase === 'shortBreak'
    ? '#4ade80'
    : '#a78bfa';

  const phaseLabel = phase === 'focus'
    ? `${Math.round(focusSeconds / 60)}分 集中タイム`
    : phase === 'shortBreak'
    ? `${Math.round(shortBreakSeconds / 60)}分 休憩タイム`
    : `${Math.round(longBreakSeconds / 60)}分 大休憩`;

  // カウントダウン用
  const countdownTotalSec = activeBlock?.plannedDurationSec ?? 0;
  const elapsedSec        = Math.max(countdownTotalSec - secondsRemaining, 0);
  const countdownRingPct  = countdownTotalSec > 0
    ? Math.round((secondsRemaining / countdownTotalSec) * 100)
    : 0;

  // ── IDLE ──────────────────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.idleHeader}>
          <Text style={styles.idleTitle}>今日のブロックを選択</Text>
          <Text style={styles.idleSubtitle}>
            {format(new Date(), 'M月d日')} のスケジュール
          </Text>
        </View>

        <ScrollView
          style={styles.idleScroll}
          contentContainerStyle={styles.idleScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {blocks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>今日の予定がありません</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/(tabs)/calendar')}
              >
                <Text style={styles.emptyBtnText}>カレンダーで追加する</Text>
              </TouchableOpacity>
            </View>
          ) : (
            blocks.map((block) => (
              <BlockPickerRow
                key={block.id}
                block={block}
                onPress={() => void handleSelectBlock(block)}
              />
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ── ACTIVE: ポモドーロ ────────────────────────────────────────────────────

  if (mode === 'pomodoro') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.activeContainer}>

          <SubjectArea
            categoryColor={categoryColor}
            categoryName={categoryName}
            subIcon={subIcon}
            subName={subName}
            curriculumName={curriculumName}
          />

          {/* タイマーリング */}
          <View style={styles.ringArea}>
            <TimerRing percent={pomodoroRingPercent} color={phaseColor}>
              <Text style={styles.timeText}>{formatTime(secondsRemaining)}</Text>
              <Text style={styles.phaseText}>{phaseLabel}</Text>
            </TimerRing>
          </View>

          {/* 一時停止ボタン */}
          <View style={styles.controlArea}>
            <TouchableOpacity
              style={styles.pauseBtn}
              onPress={handleTogglePause}
              activeOpacity={0.8}
            >
              <Text style={styles.pauseIcon}>{isRunning ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
          </View>

          {/* セッションドット */}
          <View style={styles.dotsArea}>
            <View style={styles.dotsRow}>
              {Array.from({ length: totalSessions }, (_, i) => (
                <SessionDot key={i} index={i} currentIndex={currentSession - 1} />
              ))}
            </View>
            <Text style={styles.dotsLabel}>
              {currentSession}/{totalSessions} セット ・ 集中 {Math.round(focusSeconds / 60)}分 →{' '}
              休憩 {Math.round(shortBreakSeconds / 60)}分
            </Text>
          </View>

          <BottomArea nextBlock={nextBlock} onInterrupt={handleInterrupt} />
        </View>
      </View>
    );
  }

  // ── ACTIVE: カウントダウン ────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.activeContainer}>

        <SubjectArea
          categoryColor={categoryColor}
          categoryName={categoryName}
          subIcon={subIcon}
          subName={subName}
          curriculumName={curriculumName}
        />

        {/* タイマーリング（オレンジ） */}
        <View style={styles.ringArea}>
          <TimerRing percent={countdownRingPct} color={ORANGE}>
            <Text style={styles.timeText}>{formatTime(secondsRemaining)}</Text>
            <Text style={styles.phaseText}>残り時間</Text>
          </TimerRing>
        </View>

        {/* 一時停止ボタン */}
        <View style={styles.controlArea}>
          <TouchableOpacity
            style={styles.pauseBtn}
            onPress={handleTogglePause}
            activeOpacity={0.8}
          >
            <Text style={styles.pauseIcon}>{isRunning ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
        </View>

        {/* 経過 / 残り時間カード */}
        <View style={styles.cdCard}>
          <View style={styles.cdBox}>
            <Text style={styles.cdValue}>{formatTime(elapsedSec)}</Text>
            <Text style={styles.cdLabel}>経過時間</Text>
          </View>
          <View style={styles.cdDivider} />
          <View style={styles.cdBox}>
            <Text style={styles.cdValue}>{formatTime(secondsRemaining)}</Text>
            <Text style={styles.cdLabel}>残り時間</Text>
          </View>
        </View>

        {/* 時刻表示 */}
        {blockDetails && (
          <Text style={styles.cdTimeRange}>
            {blockDetails.start_time.slice(0, 5)} – {blockDetails.end_time.slice(0, 5)}
            （{Math.round(countdownTotalSec / 60)}分）
          </Text>
        )}

        <BottomArea nextBlock={nextBlock} onInterrupt={handleInterrupt} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Idle ──────────────────────────────────────────────────────────────────

  idleHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  idleTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: -0.3,
  },
  idleSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  idleScroll: { flex: 1 },
  idleScrollContent: { padding: 16, paddingBottom: 32 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyIcon:  { fontSize: 52 },
  emptyText:  { fontSize: 15, color: 'rgba(255,255,255,0.45)' },
  emptyBtn: {
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.3)',
  },
  emptyBtnText: { fontSize: 14, color: CYAN, fontWeight: '600' },

  // ── Active 共通 ───────────────────────────────────────────────────────────

  activeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  // 科目バッジエリア
  topArea: { alignItems: 'center', gap: 8 },
  subjectBadge: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  subjectText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  subLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },

  // リングエリア
  ringArea: { alignItems: 'center', justifyContent: 'center' },
  timeText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 2,
    marginTop: -7,
    lineHeight: 50,
  },
  phaseText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    letterSpacing: 0.5,
  },

  // 一時停止ボタン
  controlArea: { alignItems: 'center' },
  pauseBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIcon: { fontSize: 22, color: '#fff' },

  // ── ポモドーロ専用 ────────────────────────────────────────────────────────

  dotsArea: { alignItems: 'center', gap: 10 },
  dotsRow:  { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  dotsLabel:{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', letterSpacing: 0.2 },

  // ── カウントダウン専用 ────────────────────────────────────────────────────

  cdCard: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  cdBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  cdDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  cdValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 1,
  },
  cdLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
  cdTimeRange: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // ── 共通下部 ──────────────────────────────────────────────────────────────

  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  nextPrefix: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '600', flexShrink: 0 },
  nextName:   { fontSize: 13, fontWeight: '700', flexShrink: 1, flex: 1 },
  nextSub:    { fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 1 },
  nextTime:   { fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0 },

  interruptBtn:  { paddingVertical: 8, paddingHorizontal: 20 },
  interruptText: { fontSize: 13, color: 'rgba(255,255,255,0.28)', fontWeight: '500' },
});
