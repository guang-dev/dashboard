import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const settings = db.prepare('SELECT * FROM fund_settings WHERE id = 1').get();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch fund settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { totalFundValue } = await request.json();

    if (totalFundValue === undefined) {
      return NextResponse.json(
        { error: 'Total fund value is required' },
        { status: 400 }
      );
    }

    db.prepare(`
      UPDATE fund_settings
      SET total_fund_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(totalFundValue);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update fund settings' },
      { status: 500 }
    );
  }
}
