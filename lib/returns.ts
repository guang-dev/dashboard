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

export interface CapitalTransaction {
  id: number;
  user_id: number;
  date: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  note: string | null;
}

export interface FundReturnData {
  date: string;
  percent_change: number;
}

/**
 * Calculate account value with mid-month capital transactions
 *
 * This function properly handles capital additions/withdrawals mid-month by:
 * 1. Starting with the beginning value
 * 2. For each day, applying any capital transactions that occurred on that day BEFORE applying returns
 * 3. Applying the daily return percentage to the current balance
 *
 * This ensures new capital only earns returns from the date it was added.
 */
export function calculateAccountValueWithTransactions(
  beginningValue: number,
  fundReturns: FundReturnData[],
  capitalTransactions: CapitalTransaction[]
): {
  currentValue: number;
  change: number;
  percentChange: number;
  gainFromOriginal: number;
  gainFromNewCapital: number;
  totalCapitalAdded: number;
  totalCapitalWithdrawn: number;
} {
  // Sort returns and transactions by date
  const sortedReturns = [...fundReturns].sort((a, b) => a.date.localeCompare(b.date));
  const sortedTransactions = [...capitalTransactions].sort((a, b) => a.date.localeCompare(b.date));

  let currentValue = beginningValue;
  let totalCapitalAdded = 0;
  let totalCapitalWithdrawn = 0;

  // Track capital basis for gain attribution
  let capitalBasis = beginningValue;

  // Create a map of transactions by date for quick lookup
  const transactionsByDate = new Map<string, CapitalTransaction[]>();
  for (const tx of sortedTransactions) {
    if (!transactionsByDate.has(tx.date)) {
      transactionsByDate.set(tx.date, []);
    }
    transactionsByDate.get(tx.date)!.push(tx);
  }

  // Get all unique dates (returns + transactions)
  const allDates = new Set<string>();
  sortedReturns.forEach(r => allDates.add(r.date));
  sortedTransactions.forEach(t => allDates.add(t.date));
  const sortedDates = Array.from(allDates).sort();

  // Process each date
  for (const date of sortedDates) {
    // First, apply any capital transactions for this date (BEFORE returns)
    const dayTransactions = transactionsByDate.get(date) || [];
    for (const tx of dayTransactions) {
      if (tx.type === 'deposit') {
        currentValue += tx.amount;
        capitalBasis += tx.amount;
        totalCapitalAdded += tx.amount;
      } else {
        currentValue -= tx.amount;
        capitalBasis -= tx.amount;
        totalCapitalWithdrawn += tx.amount;
      }
    }

    // Then, apply returns for this date (if any)
    const dayReturn = sortedReturns.find(r => r.date === date);
    if (dayReturn && dayReturn.percent_change !== undefined) {
      const dailyGain = currentValue * (dayReturn.percent_change / 100);
      currentValue += dailyGain;
    }
  }

  // Calculate overall change and percent
  // The "effective beginning" for percent calculation should account for capital changes
  const effectiveBeginning = beginningValue + totalCapitalAdded - totalCapitalWithdrawn;
  const totalChange = currentValue - effectiveBeginning;

  // For percentage change, we use time-weighted calculation
  // Simple approximation: use the beginning value as the denominator
  const percentChange = beginningValue !== 0 ? ((currentValue - effectiveBeginning) / beginningValue) * 100 : 0;

  // Calculate gain attribution
  const gainFromOriginal = currentValue - capitalBasis;
  const gainFromNewCapital = 0; // This would require more complex tracking

  return {
    currentValue,
    change: totalChange,
    percentChange,
    gainFromOriginal,
    gainFromNewCapital,
    totalCapitalAdded,
    totalCapitalWithdrawn
  };
}

// Get capital transactions for a user for a specific month
export function getCapitalTransactionsForMonth(
  userId: number,
  year: number,
  month: number
): CapitalTransaction[] {
  const monthStr = String(month).padStart(2, '0');
  const pattern = `${year}-${monthStr}-%`;

  return db.prepare(`
    SELECT id, user_id, date, amount, type, note
    FROM capital_transactions
    WHERE user_id = ? AND date LIKE ?
    ORDER BY date ASC
  `).all(userId, pattern) as CapitalTransaction[];
}
