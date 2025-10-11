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
      SELECT id, date, dollar_change, total_fund_value, percent_change
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
    const { date, percentChange, totalFundValue } = await request.json();

    if (!date || percentChange === undefined || !totalFundValue) {
      return NextResponse.json(
        { error: 'Date, percent change, and total fund value are required' },
        { status: 400 }
      );
    }

    // Calculate dollar change from percent change
    const dollarChange = (percentChange / 100) * totalFundValue;

    db.prepare(`
      INSERT INTO fund_returns (date, dollar_change, total_fund_value, percent_change)
      VALUES (?, ?, ?, ?)
    `).run(date, dollarChange, totalFundValue, percentChange);

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
    const { id, percentChange, dollarChange, totalFundValue } = await request.json();

    if (!id || totalFundValue === undefined) {
      return NextResponse.json(
        { error: 'ID and total fund value are required' },
        { status: 400 }
      );
    }

    // If percentChange is provided, calculate dollarChange from it
    let finalDollarChange = dollarChange;
    let finalPercentChange = percentChange;

    if (percentChange !== undefined) {
      finalDollarChange = (percentChange / 100) * totalFundValue;
      finalPercentChange = percentChange;
    } else if (dollarChange !== undefined) {
      // If only dollarChange is provided (for legacy updates), calculate percentChange
      finalPercentChange = totalFundValue !== 0 ? (dollarChange / totalFundValue) * 100 : 0;
    }

    db.prepare(`
      UPDATE fund_returns
      SET dollar_change = ?, total_fund_value = ?, percent_change = ?
      WHERE id = ?
    `).run(finalDollarChange, totalFundValue, finalPercentChange, id);

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
