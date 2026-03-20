/**
 * ローカル通知ヘルパー
 *
 * - requestPermissions()             — 通知権限リクエスト
 * - scheduleSessionReminder()        — ブロック開始前リマインド
 * - scheduleWeeklyPlanReminder()     — 週間プラン作成リマインド（毎週）
 * - scheduleWeeklyReportReminder()   — 週次レポート通知（毎週）
 * - cancelNotification(blockId)      — 特定ブロックの通知キャンセル
 * - rescheduleAllNotifications()     — 全通知再スケジュール
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BlockWithDetails } from '@/types/database';

// ---------------------------------------------------------------------------
// 通知ハンドラ（フォアグラウンドでも表示）
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ---------------------------------------------------------------------------
// AsyncStorage キー
// ---------------------------------------------------------------------------

/** blockId → Expo 通知 ID のマップ */
const BLOCK_NOTIF_MAP_KEY = '@agendary:notif_block_map';
/** 週間プランリマインドの Expo 通知 ID */
const WEEKLY_PLAN_NOTIF_KEY = '@agendary:notif_weekly_plan';
/** 週次レポートリマインドの Expo 通知 ID */
const WEEKLY_REPORT_NOTIF_KEY = '@agendary:notif_weekly_report';

// ---------------------------------------------------------------------------
// マップ操作ヘルパー
// ---------------------------------------------------------------------------

async function getBlockNotifMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(BLOCK_NOTIF_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function saveBlockNotifMap(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(BLOCK_NOTIF_MAP_KEY, JSON.stringify(map));
}

async function setBlockNotifId(blockId: string, notifId: string): Promise<void> {
  const map = await getBlockNotifMap();
  map[blockId] = notifId;
  await saveBlockNotifMap(map);
}

async function removeBlockNotifId(blockId: string): Promise<string | null> {
  const map = await getBlockNotifMap();
  const notifId = map[blockId] ?? null;
  delete map[blockId];
  await saveBlockNotifMap(map);
  return notifId;
}

// ---------------------------------------------------------------------------
// 通知本文ビルダー
// ---------------------------------------------------------------------------

/** 「10:00 から 📖 講義 ・ 第4回 時効」形式 */
function buildSessionBody(block: BlockWithDetails): string {
  const time = block.start_time.slice(0, 5);
  const parts: string[] = [`${time} から`];

  if (block.sub_categories) {
    const icon = block.sub_categories.icon ?? '';
    parts.push(`${icon} ${block.sub_categories.name}`.trim());
  }

  if (block.curriculum_tasks) {
    parts.push(`・ ${block.curriculum_tasks.name}`);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// 1. 権限リクエスト
// ---------------------------------------------------------------------------

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---------------------------------------------------------------------------
// 2. セッションリマインド（ブロック開始 n 分前）
// ---------------------------------------------------------------------------

/**
 * ブロックの開始時刻の minutesBefore 分前に通知をスケジュールする。
 * 既存の通知がある場合はキャンセルしてから再登録。
 * 過去日時の場合はスキップ（null を返す）。
 */
export async function scheduleSessionReminder(
  block: BlockWithDetails,
  minutesBefore: number,
): Promise<string | null> {
  if (!minutesBefore || minutesBefore <= 0) return null;

  try {
    // 既存通知をキャンセル
    await cancelNotification(block.id);

    // トリガー時刻を計算
    const [hh, mm] = block.start_time.split(':').map(Number);
    const triggerDate = new Date(`${block.date}T00:00:00`);
    triggerDate.setHours(hh ?? 0, (mm ?? 0) - minutesBefore, 0, 0);

    if (triggerDate <= new Date()) return null; // 過去はスキップ

    const catName = block.activity_categories?.name ?? 'ブロック';
    const title   = `${catName} の時間です`;
    const body    = buildSessionBody(block);

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { blockId: block.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    await setBlockNotifId(block.id, notifId);
    return notifId;
  } catch (e) {
    console.warn('[notifications] scheduleSessionReminder error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. 週間プラン作成リマインド（毎週繰り返し）
// ---------------------------------------------------------------------------

/**
 * 週の始まりの前日 18:00 に毎週通知をスケジュールする。
 * 例: weekStartDay=1（月）→ 日曜 18:00
 *
 * @param weekStartDay  0=日〜6=土
 */
export async function scheduleWeeklyPlanReminder(weekStartDay: number): Promise<void> {
  try {
    // 既存の週間プランリマインドをキャンセル
    const existing = await AsyncStorage.getItem(WEEKLY_PLAN_NOTIF_KEY);
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
    }

    // 前日の曜日（expo weekday: 1=日〜7=土）
    const endOfWeekDow  = (weekStartDay + 6) % 7;          // 0=日〜6=土
    const expoWeekday   = endOfWeekDow === 0 ? 1 : endOfWeekDow + 1; // 1=日〜7=土

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '来週のプランを作りましょう',
        body:  'カレンダーで予定を埋めましょう',
      },
      trigger: {
        type:     Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday:  expoWeekday,
        hour:     18,
        minute:   0,
      },
    });

    await AsyncStorage.setItem(WEEKLY_PLAN_NOTIF_KEY, notifId);
  } catch (e) {
    console.warn('[notifications] scheduleWeeklyPlanReminder error:', e);
  }
}

// ---------------------------------------------------------------------------
// 4. 週次レポート通知（毎週繰り返し）
// ---------------------------------------------------------------------------

/**
 * 週の最終日 20:00 に毎週通知をスケジュールする。
 * 例: weekStartDay=1（月）→ 日曜 20:00
 *
 * @param weekStartDay  0=日〜6=土
 */
export async function scheduleWeeklyReportReminder(weekStartDay: number): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(WEEKLY_REPORT_NOTIF_KEY);
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
    }

    const endOfWeekDow = (weekStartDay + 6) % 7;
    const expoWeekday  = endOfWeekDow === 0 ? 1 : endOfWeekDow + 1;

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '今週の振り返りが準備できました',
        body:  'レポートで今週の学習を確認しましょう',
      },
      trigger: {
        type:     Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday:  expoWeekday,
        hour:     20,
        minute:   0,
      },
    });

    await AsyncStorage.setItem(WEEKLY_REPORT_NOTIF_KEY, notifId);
  } catch (e) {
    console.warn('[notifications] scheduleWeeklyReportReminder error:', e);
  }
}

// ---------------------------------------------------------------------------
// 5. 特定ブロックの通知キャンセル
// ---------------------------------------------------------------------------

/**
 * blockId に紐づく通知をキャンセルし、マップから削除する。
 */
export async function cancelNotification(blockId: string): Promise<void> {
  try {
    const notifId = await removeBlockNotifId(blockId);
    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
    }
  } catch (e) {
    console.warn('[notifications] cancelNotification error:', e);
  }
}

// ---------------------------------------------------------------------------
// 6. 全ブロック通知の再スケジュール
// ---------------------------------------------------------------------------

/**
 * 全ブロックのセッションリマインドを再スケジュールする。
 * ブロックデータの変更後（例: タイムゾーン変更、設定変更）に呼ぶ。
 *
 * @param blocks       再スケジュール対象のブロック一覧
 * @param weekStartDay 週の始まり（週間通知の再登録にも使用）
 */
export async function rescheduleAllNotifications(
  blocks: BlockWithDetails[],
  weekStartDay: number,
): Promise<void> {
  try {
    // 1. 全スケジュール済み通知をキャンセル
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 2. ブロックマップをリセット
    await saveBlockNotifMap({});
    await AsyncStorage.removeItem(WEEKLY_PLAN_NOTIF_KEY);
    await AsyncStorage.removeItem(WEEKLY_REPORT_NOTIF_KEY);

    // 3. 未来のブロックのみ再スケジュール
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const block of blocks) {
      if (!block.reminder_minutes || block.is_ghost || block.status === 'skipped') continue;

      const blockDate = new Date(`${block.date}T00:00:00`);
      if (blockDate < today) continue; // 過去日はスキップ

      await scheduleSessionReminder(block, block.reminder_minutes);
    }

    // 4. 週間リマインドを再登録
    await scheduleWeeklyPlanReminder(weekStartDay);
    await scheduleWeeklyReportReminder(weekStartDay);
  } catch (e) {
    console.warn('[notifications] rescheduleAllNotifications error:', e);
  }
}

// ---------------------------------------------------------------------------
// 後方互換エクスポート（BlockAddSheet が直接呼ぶケース向け）
// ---------------------------------------------------------------------------

/** @deprecated scheduleSessionReminder を使用してください */
export async function scheduleBlockReminder(
  blockId: string,
  title: string,
  body: string,
  triggerDate: Date,
): Promise<string | null> {
  try {
    if (triggerDate <= new Date()) return null;

    const notifId = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { blockId } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    await setBlockNotifId(blockId, notifId);
    return notifId;
  } catch (e) {
    console.warn('[notifications] scheduleBlockReminder error:', e);
    return null;
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
