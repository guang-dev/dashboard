import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST() {
  try {
    // Check current count
    const currentCount = db.prepare('SELECT COUNT(*) as count FROM trading_calendar').get() as { count: number };

    if (currentCount.count > 0) {
      return NextResponse.json({
        message: 'Calendar already initialized',
        count: currentCount.count
      });
    }

    // Populate trading calendar
    const tradingDays = [
      // October 2025
      ...Array.from({ length: 3 }, (_, i) => `2025-10-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `2025-10-${String(i + 6).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `2025-10-${String(i + 13).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `2025-10-${String(i + 20).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `2025-10-${String(i + 27).padStart(2, '0')}`),
      // November 2025
      ...Array.from({ length: 5 }, (_, i) => `2025-11-${String(i + 3).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `2025-11-${String(i + 10).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `2025-11-${String(i + 17).padStart(2, '0')}`),
      '2025-11-24', '2025-11-25', '2025-11-26',
      // December 2025
      ...Array.from({ length: 5 }, (_, i) => `2025-12-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `2025-12-${String(i + 8).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, i) => `2025-12-${String(i + 15).padStart(2, '0')}`),
      '2025-12-22', '2025-12-23', '2025-12-24', '2025-12-26',
      ...Array.from({ length: 3 }, (_, i) => `2025-12-${String(i + 29).padStart(2, '0')}`),
    ];

    const halfDays = ['2025-11-28', '2025-12-24'];

    const insertStmt = db.prepare('INSERT OR IGNORE INTO trading_calendar (date, is_half_day) VALUES (?, ?)');
    let inserted = 0;
    for (const date of tradingDays) {
      const result = insertStmt.run(date, halfDays.includes(date) ? 1 : 0);
      if (result.changes > 0) inserted++;
    }

    return NextResponse.json({
      success: true,
      message: 'Calendar initialized',
      inserted
    });
  } catch (error) {
    console.error('Calendar initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize calendar', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM trading_calendar').get() as { count: number };
    const sample = db.prepare('SELECT date, is_half_day FROM trading_calendar ORDER BY date LIMIT 10').all();

    return NextResponse.json({
      count: count.count,
      sample
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check calendar', details: String(error) },
      { status: 500 }
    );
  }
}
