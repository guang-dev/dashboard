import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json(
        { error: 'Year and month are required' },
        { status: 400 }
      );
    }

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;

    const returns = db.prepare(`
      SELECT id, date, dollar_change, total_fund_value
      FROM fund_returns
      WHERE date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(startDate, endDate);

    return NextResponse.json({ returns });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch fund returns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { date, dollarChange, totalFundValue } = await request.json();

    if (!date || dollarChange === undefined || !totalFundValue) {
      return NextResponse.json(
        { error: 'Date, dollar change, and total fund value are required' },
        { status: 400 }
      );
    }

    db.prepare(`
      INSERT INTO fund_returns (date, dollar_change, total_fund_value)
      VALUES (?, ?, ?)
    `).run(date, dollarChange, totalFundValue);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add fund return' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, dollarChange, totalFundValue } = await request.json();

    if (!id || dollarChange === undefined || !totalFundValue) {
      return NextResponse.json(
        { error: 'ID, dollar change, and total fund value are required' },
        { status: 400 }
      );
    }

    db.prepare(`
      UPDATE fund_returns
      SET dollar_change = ?, total_fund_value = ?
      WHERE id = ?
    `).run(dollarChange, totalFundValue, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update fund return' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    db.prepare('DELETE FROM fund_returns WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete fund return' },
      { status: 500 }
    );
  }
}
