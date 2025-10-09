import { NextRequest, NextResponse } from 'next/server';
import { createUser, getAllUsers, deleteUser, getUserById } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // If ID is provided, return single user
    if (id) {
      const user = getUserById(parseInt(id));
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ user });
    }

    // Otherwise return all users
    const users = getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, firstName, lastName, beginningValue, ownershipPercentage } = await request.json();

    if (!username || !password || !firstName || !lastName || beginningValue === undefined) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const userId = createUser(username, password, firstName, lastName, beginningValue, ownershipPercentage || 0);

    if (!userId) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, id: userId });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, firstName, lastName, beginningValue, ownershipPercentage } = await request.json();

    if (!id || !firstName || !lastName || beginningValue === undefined || ownershipPercentage === undefined) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const { updateUser } = await import('@/lib/auth');
    const success = updateUser(id, firstName, lastName, beginningValue, ownershipPercentage);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update user' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user' },
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
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const success = deleteUser(parseInt(id));

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
