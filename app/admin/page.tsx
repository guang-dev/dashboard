'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  beginning_value: number;
  is_admin: number;
}

interface DailyReturn {
  id: number;
  date: string;
  percentage: number;
}

interface TradingDay {
  date: string;
  is_half_day: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dailyReturns, setDailyReturns] = useState<DailyReturn[]>([]);
  const [tradingDays, setTradingDays] = useState<TradingDay[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingReturn, setEditingReturn] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Account summary
  const [accountSummary, setAccountSummary] = useState({
    currentValue: 0,
    change: 0,
    percentChange: 0
  });

  // New user form
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    beginningValue: ''
  });

  // Daily return form
  const [newReturn, setNewReturn] = useState({
    date: new Date().toISOString().split('T')[0],
    dollarChange: ''
  });

  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userStr);
    if (!user.is_admin) {
      router.push('/dashboard');
      return;
    }

    setCurrentUser(user);
    loadUsers();
    loadTradingCalendar();
  }, [router]);

  useEffect(() => {
    if (selectedUser) {
      loadDailyReturns(selectedUser.id);
      loadTradingCalendar();
    } else {
      setDailyReturns([]);
    }
  }, [selectedUser, selectedDate]);

  const loadUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      if (data.users.length > 0 && !selectedUser) {
        setSelectedUser(data.users[0]);
      }
    }
  };

  const loadTradingCalendar = async () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const res = await fetch(`/api/calendar?year=${year}&month=${month}&t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Loaded calendar:', data.days);
      setTradingDays([...data.days]); // Force new array reference
    } else {
      console.error('Failed to load calendar');
    }
  };

  const loadDailyReturns = async (userId: number) => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const res = await fetch(`/api/returns?userId=${userId}&year=${year}&month=${month}&t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Loaded returns:', data.returns);
      setDailyReturns([...data.returns]); // Force new array reference
      calculateAccountSummary(data.returns);
    } else {
      console.error('Failed to load returns');
    }
  };

  const handlePreviousMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  const calculateAccountSummary = (returns: DailyReturn[]) => {
    if (!selectedUser) return;

    // Only include returns that are on trading calendar days
    const tradingDates = new Set(tradingDays.map(day => day.date));
    const validReturns = returns.filter(ret => tradingDates.has(ret.date));

    let currentValue = selectedUser.beginning_value;
    for (const ret of validReturns) {
      const dailyChange = currentValue * (ret.percentage / 100);
      currentValue += dailyChange;
    }

    const change = currentValue - selectedUser.beginning_value;
    const percentChange = selectedUser.beginning_value !== 0
      ? (change / selectedUser.beginning_value) * 100
      : 0;

    setAccountSummary({ currentValue, change, percentChange });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUser.username,
        password: newUser.password,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        beginningValue: parseFloat(newUser.beginningValue)
      }),
    });

    if (res.ok) {
      setNewUser({ username: '', password: '', firstName: '', lastName: '', beginningValue: '' });
      setShowUserForm(false);
      loadUsers();
      alert('User created successfully!');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user? All their data will be lost.')) return;

    const res = await fetch(`/api/users?id=${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      if (selectedUser?.id === id) {
        setSelectedUser(null);
      }
      loadUsers();
      alert('User deleted successfully!');
    }
  };

  const handleAddReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      alert('Please select a user first');
      return;
    }

    // Calculate percentage from dollar change
    const dollarChange = parseFloat(newReturn.dollarChange);
    const currentValueForDate = getCurrentValueForDate(newReturn.date);
    const percentage = currentValueForDate !== 0 ? (dollarChange / currentValueForDate) * 100 : 0;

    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: selectedUser.id,
        date: newReturn.date,
        percentage: percentage
      }),
    });

    if (res.ok) {
      setNewReturn({ date: new Date().toISOString().split('T')[0], dollarChange: '' });
      await loadDailyReturns(selectedUser.id);
      alert('Return added successfully!');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to add return');
    }
  };

  const handleDeleteReturn = async (id: number) => {
    if (!confirm('Are you sure you want to delete this return?')) return;

    const res = await fetch(`/api/returns?id=${id}`, {
      method: 'DELETE',
    });

    if (res.ok && selectedUser) {
      loadDailyReturns(selectedUser.id);
    }
  };

  const handleEditReturn = async (returnId: number, dollarChange: string) => {
    if (!selectedUser) return;

    const ret = dailyReturns.find(r => r.id === returnId);
    if (!ret) return;

    const currentValueForDate = getCurrentValueForDate(ret.date);
    const percentage = currentValueForDate !== 0 ? (parseFloat(dollarChange) / currentValueForDate) * 100 : 0;

    const res = await fetch('/api/returns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: returnId,
        percentage: percentage
      }),
    });

    if (res.ok) {
      setEditingReturn(null);
      setEditValue('');
      loadDailyReturns(selectedUser.id);
    }
  };

  const getCurrentValueForDate = (targetDate: string): number => {
    if (!selectedUser) return 0;

    let currentValue = selectedUser.beginning_value;
    const sortedReturns = [...dailyReturns].sort((a, b) => a.date.localeCompare(b.date));

    for (const ret of sortedReturns) {
      if (ret.date >= targetDate) break;
      const dailyChange = currentValue * (ret.percentage / 100);
      currentValue += dailyChange;
    }

    return currentValue;
  };

  const getDollarChangeForReturn = (ret: DailyReturn): number => {
    const currentValueForDate = getCurrentValueForDate(ret.date);
    return currentValueForDate * (ret.percentage / 100);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    router.push('/');
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  const monthName = selectedDate.toLocaleString('en-US', { month: 'long' });
  const year = selectedDate.getFullYear();

  // Create a map of returns by date
  const returnsByDate = dailyReturns.reduce((acc, ret) => {
    acc[ret.date] = ret;
    return acc;
  }, {} as Record<string, DailyReturn>);

  // Merge trading days with returns
  const dailyData = tradingDays.map(day => ({
    date: day.date,
    isHalfDay: day.is_half_day === 1,
    return: returnsByDate[day.date] || null,
    isValid: true  // Mark trading days as valid
  }));

  // Add non-trading day returns at the end (they won't count in calculations)
  const tradingDates = new Set(tradingDays.map(day => day.date));
  const nonTradingReturns = dailyReturns.filter(ret => !tradingDates.has(ret.date));

  for (const ret of nonTradingReturns) {
    dailyData.push({
      date: ret.date,
      isHalfDay: false,
      return: ret,
      isValid: false  // Mark non-trading days as invalid
    });
  }

  // Sort by date
  dailyData.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate cumulative return for each day (only for valid trading days)
  let cumulativeReturn = 0;
  let runningValue = selectedUser?.beginning_value || 0;
  const dailyDataWithCumulative = dailyData.map(day => {
    if (day.return && day.isValid) {
      const dollarChange = runningValue * (day.return.percentage / 100);
      runningValue += dollarChange;
      cumulativeReturn = ((1 + cumulativeReturn / 100) * (1 + day.return.percentage / 100) - 1) * 100;
    }
    return {
      ...day,
      cumulativeReturn: day.return && day.isValid ? cumulativeReturn : null,
      dollarChange: day.return ? runningValue - (runningValue - runningValue * (day.return.percentage / 100)) : null
    };
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUserForm(!showUserForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {showUserForm ? 'Hide Form' : 'Add New User'}
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* New User Form */}
        {showUserForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Create New User</h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
              <input
                type="text"
                placeholder="First Name"
                value={newUser.firstName}
                onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                value={newUser.lastName}
                onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Beginning Value"
                value={newUser.beginningValue}
                onChange={(e) => setNewUser({ ...newUser, beginningValue: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 md:col-span-5"
              >
                Create User
              </button>
            </form>
          </div>
        )}

        {/* User Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Select User</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedUser?.id === user.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedUser(user)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{user.first_name} {user.last_name}</h3>
                    <p className="text-sm text-gray-600">@{user.username}</p>
                    <p className="text-sm text-gray-800 mt-2">
                      Beginning: ${user.beginning_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteUser(user.id);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedUser && (
          <>
            {/* Account Summary */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                Dashboard Preview for {selectedUser.first_name} {selectedUser.last_name}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Beginning Value:</span>
                  <span className="font-semibold text-gray-800">
                    ${selectedUser.beginning_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Change:</span>
                  <span className={`font-semibold ${accountSummary.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {accountSummary.change >= 0 ? '+' : ''}${accountSummary.change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">% Change:</span>
                  <span className={`font-semibold ${accountSummary.percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {accountSummary.percentChange >= 0 ? '+' : ''}{accountSummary.percentChange.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="text-gray-600">Current Value:</span>
                  <span className="font-bold text-xl text-gray-800">
                    ${accountSummary.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Add New Return Form */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Add New Return</h2>
              <form onSubmit={handleAddReturn} className="flex gap-4">
                <input
                  type="date"
                  value={newReturn.date}
                  onChange={(e) => setNewReturn({ ...newReturn, date: e.target.value })}
                  className="px-3 py-2 border rounded-md"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Dollar change (e.g., 1500 or -500)"
                  value={newReturn.dollarChange}
                  onChange={(e) => setNewReturn({ ...newReturn, dollarChange: e.target.value })}
                  className="px-3 py-2 border rounded-md flex-1"
                  required
                />
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
                >
                  Add Return
                </button>
              </form>
            </div>

            {/* Daily Returns Table */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-800">
                  Daily Returns
                </h2>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePreviousMonth}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-lg font-medium text-gray-700">
                    {monthName} {year}
                  </span>
                  <button
                    onClick={handleNextMonth}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-right">Daily Change ($)</th>
                      <th className="px-4 py-2 text-right">Daily Return (%)</th>
                      <th className="px-4 py-2 text-right">Month's Return (%)</th>
                      <th className="px-4 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyDataWithCumulative.map((day, idx) => {
                      const dateObj = new Date(day.date + 'T00:00:00');
                      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                      const monthDay = dateObj.getDate();
                      const isEditing = editingReturn === day.return?.id;

                      return (
                        <tr key={idx} className={`border-t hover:bg-gray-50 ${!day.isValid ? 'bg-red-50 opacity-60' : ''}`}>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 w-12">{dayOfWeek}</span>
                              <span className="font-medium">{monthDay}</span>
                              {day.isHalfDay && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Half
                                </span>
                              )}
                              {!day.isValid && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                  Non-Trading Day
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-32 px-2 py-1 border rounded text-right"
                                autoFocus
                              />
                            ) : day.return ? (
                              <span className={`font-medium ${getDollarChangeForReturn(day.return) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {getDollarChangeForReturn(day.return) >= 0 ? '+' : ''}
                                ${getDollarChangeForReturn(day.return).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-medium ${
                            day.return === null ? 'text-gray-400' :
                            day.return.percentage >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {day.return !== null ? (
                              <>{day.return.percentage >= 0 ? '+' : ''}{day.return.percentage.toFixed(1)}%</>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-medium ${
                            day.cumulativeReturn === null ? 'text-gray-400' :
                            day.cumulativeReturn >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {day.cumulativeReturn !== null ? (
                              <>{day.cumulativeReturn >= 0 ? '+' : ''}{day.cumulativeReturn.toFixed(1)}%</>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {day.return && (
                              <div className="flex gap-2 justify-center">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleEditReturn(day.return!.id, editValue)}
                                      className="text-green-600 hover:text-green-800 text-sm"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingReturn(null);
                                        setEditValue('');
                                      }}
                                      className="text-gray-600 hover:text-gray-800 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingReturn(day.return!.id);
                                        setEditValue(getDollarChangeForReturn(day.return!).toFixed(2));
                                      }}
                                      className="text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteReturn(day.return!.id)}
                                      className="text-red-600 hover:text-red-800 text-sm"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
