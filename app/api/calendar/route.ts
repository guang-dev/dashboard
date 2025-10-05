import { NextRequest, NextResponse } from 'next/server';
import { getTradingDaysForMonth } from '@/lib/returns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    const days = getTradingDaysForMonth(year, month);
    return NextResponse.json({ days });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch calendar' },
      { status: 500 }
    );
  }
}
