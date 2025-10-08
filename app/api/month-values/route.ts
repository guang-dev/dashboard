import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (year && month) {
      // Get specific month
      const value = db.prepare(`
        SELECT beginning_value, ownership_percentage
        FROM month_beginning_values
        WHERE user_id = ? AND year = ? AND month = ?
      `).get(userId, year, month);

      return NextResponse.json({ value: value || null });
    } else {
      // Get all months for user
      const values = db.prepare(`
        SELECT year, month, beginning_value, ownership_percentage
        FROM month_beginning_values
        WHERE user_id = ?
        ORDER BY year DESC, month DESC
      `).all(userId);

      return NextResponse.json({ values });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch month values' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, year, month, beginningValue, ownershipPercentage } = await request.json();

    if (!userId || !year || !month || beginningValue === undefined || ownershipPercentage === undefined) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    db.prepare(`
      INSERT OR REPLACE INTO month_beginning_values (user_id, year, month, beginning_value, ownership_percentage)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, year, month, beginningValue, ownershipPercentage);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save month values' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!userId || !year || !month) {
      return NextResponse.json(
        { error: 'User ID, year, and month are required' },
        { status: 400 }
      );
    }

    db.prepare(`
      DELETE FROM month_beginning_values
      WHERE user_id = ? AND year = ? AND month = ?
    `).run(userId, year, month);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete month values' },
      { status: 500 }
    );
  }
}
