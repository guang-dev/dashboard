import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export interface CapitalTransaction {
  id: number;
  user_id: number;
  date: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  note: string | null;
  created_at: string;
}

// GET - fetch capital transactions for a user
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

    let transactions: CapitalTransaction[];

    if (year && month) {
      // Get transactions for a specific month
      const monthStr = String(month).padStart(2, '0');
      const pattern = `${year}-${monthStr}-%`;

      transactions = db.prepare(`
        SELECT id, user_id, date, amount, type, note, created_at
        FROM capital_transactions
        WHERE user_id = ? AND date LIKE ?
        ORDER BY date ASC
      `).all(userId, pattern) as CapitalTransaction[];
    } else {
      // Get all transactions for user
      transactions = db.prepare(`
        SELECT id, user_id, date, amount, type, note, created_at
        FROM capital_transactions
        WHERE user_id = ?
        ORDER BY date DESC
      `).all(userId) as CapitalTransaction[];
    }

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching capital transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capital transactions' },
      { status: 500 }
    );
  }
}

// POST - add a new capital transaction
export async function POST(request: NextRequest) {
  try {
    const { userId, date, amount, type, note } = await request.json();

    if (!userId || !date || amount === undefined || !type) {
      return NextResponse.json(
        { error: 'User ID, date, amount, and type are required' },
        { status: 400 }
      );
    }

    if (type !== 'deposit' && type !== 'withdrawal') {
      return NextResponse.json(
        { error: 'Type must be "deposit" or "withdrawal"' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      INSERT INTO capital_transactions (user_id, date, amount, type, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, date, Math.abs(amount), type, note || null);

    return NextResponse.json({
      success: true,
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Error adding capital transaction:', error);
    return NextResponse.json(
      { error: 'Failed to add capital transaction' },
      { status: 500 }
    );
  }
}

// DELETE - remove a capital transaction
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    db.prepare('DELETE FROM capital_transactions WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting capital transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete capital transaction' },
      { status: 500 }
    );
  }
}
