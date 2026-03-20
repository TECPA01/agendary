import { format, parse, differenceInMinutes, addMinutes } from 'date-fns';
import { ja } from 'date-fns/locale';

/** "HH:mm" 文字列をDateオブジェクトに変換 */
export function timeStringToDate(timeStr: string, baseDate = new Date()): Date {
  return parse(timeStr, 'HH:mm', baseDate);
}

/** DateオブジェクトをHH:mm文字列に変換 */
export function dateToTimeString(date: Date): string {
  return format(date, 'HH:mm');
}

/** 2つのHH:mm文字列間の分数を計算 */
export function minutesBetween(startTime: string, endTime: string): number {
  const base = new Date();
  const start = timeStringToDate(startTime, base);
  const end = timeStringToDate(endTime, base);
  return differenceInMinutes(end, start);
}

/** 活動時間（起床〜就寝）に対する充填率を計算（0〜1） */
export function calcFillRate(
  wakeTime: string,
  sleepTime: string,
  blockMinutes: number
): number {
  const total = minutesBetween(wakeTime, sleepTime);
  if (total <= 0) return 0;
  return Math.min(blockMinutes / total, 1);
}

/** 秒数をMM:SS形式にフォーマット */
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 日付を「M月d日（曜日）」形式にフォーマット */
export function formatDateJa(date: Date): string {
  return format(date, 'M月d日（E）', { locale: ja });
}
