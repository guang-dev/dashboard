import { NextRequest, NextResponse } from 'next/server';
import { addDailyReturn, getDailyReturnsForUser, deleteDailyReturn, updateDailyReturn } from '@/lib/returns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '0');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    console.log(`[API] GET /api/returns - userId: ${userId}, year: ${year}, month: ${month}`);

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const returns = getDailyReturnsForUser(userId, year, month);
    console.log(`[API] Found ${returns.length} returns:`, returns);
    return NextResponse.json({ returns });
  } catch (error) {
    console.error('[API] Error fetching returns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch returns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, date, percentage } = await request.json();

    if (!userId || !date || percentage === undefined) {
      return NextResponse.json(
        { error: 'User ID, date and percentage are required' },
        { status: 400 }
      );
    }

    const success = addDailyReturn(userId, date, percentage);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to add return' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add return' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0');

    if (!id) {
      return NextResponse.json(
        { error: 'Return ID is required' },
        { status: 400 }
      );
    }

    const success = deleteDailyReturn(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete return' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete return' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, percentage } = await request.json();

    if (!id || percentage === undefined) {
      return NextResponse.json(
        { error: 'Return ID and percentage are required' },
        { status: 400 }
      );
    }

    const success = updateDailyReturn(id, percentage);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update return' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update return' },
      { status: 500 }
    );
  }
}
