import db from './db';

export interface DailyReturn {
  id: number;
  date: string;
  percentage: number;
  user_id?: number;
}

export function addDailyReturn(userId: number, date: string, percentage: number): boolean {
  try {
    db.prepare(`
      INSERT OR REPLACE INTO daily_returns (user_id, date, percentage)
      VALUES (?, ?, ?)
    `).run(userId, date, percentage);
    return true;
  } catch (error) {
    return false;
  }
}

export function deleteDailyReturn(id: number): boolean {
  try {
    db.prepare('DELETE FROM daily_returns WHERE id = ?').run(id);
    return true;
  } catch (error) {
    return false;
  }
}

export function updateDailyReturn(id: number, percentage: number): boolean {
  try {
    db.prepare(`
      UPDATE daily_returns
      SET percentage = ?
      WHERE id = ?
    `).run(percentage, id);
    return true;
  } catch (error) {
    return false;
  }
}

export function getDailyReturnsForUser(userId: number, year: number, month: number): DailyReturn[] {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;

  return db.prepare(`
    SELECT dr.id, dr.date, dr.percentage
    FROM daily_returns dr
    WHERE dr.user_id = ? AND dr.date LIKE ?
    ORDER BY dr.date
  `).all(userId, pattern) as DailyReturn[];
}

export function getTradingDaysForMonth(year: number, month: number): Array<{ date: string; is_half_day: number }> {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;

  // First try to get from calendar
  const calendarDays = db.prepare(`
    SELECT date, is_half_day
    FROM trading_calendar
    WHERE date LIKE ?
    ORDER BY date
  `).all(pattern) as Array<{ date: string; is_half_day: number }>;

  // If calendar has days, return them
  if (calendarDays.length > 0) {
    return calendarDays;
  }

  // Otherwise, generate all weekdays for the month
  const days: Array<{ date: string; is_half_day: number }> = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    // Only include weekdays (Monday = 1 to Friday = 5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
      days.push({ date: dateStr, is_half_day: 0 });
    }
  }

  return days;
}

export function calculateAccountValue(
  beginningValue: number,
  dailyReturns: DailyReturn[]
): { currentValue: number; change: number; percentChange: number } {
  let currentValue = beginningValue;

  for (const dailyReturn of dailyReturns) {
    const dailyChange = currentValue * (dailyReturn.percentage / 100);
    currentValue += dailyChange;
  }

  const change = currentValue - beginningValue;
  const percentChange = beginningValue !== 0 ? (change / beginningValue) * 100 : 0;

  return {
    currentValue,
    change,
    percentChange
  };
}

export function calculateMonthReturn(dailyReturns: DailyReturn[]): number {
  let cumulativeReturn = 1;

  for (const dailyReturn of dailyReturns) {
    cumulativeReturn *= (1 + dailyReturn.percentage / 100);
  }

  return (cumulativeReturn - 1) * 100;
}
