'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  beginning_value: number;
  ownership_percentage: number;
  is_admin: number;
}

interface FundReturn {
  id: number;
  date: string;
  dollar_change: number;
  total_fund_value: number;
}

interface TradingDay {
  date: string;
  is_half_day: number;
}

interface UserSummary {
  user: User;
  currentValue: number;
  change: number;
  percentChange: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [fundReturns, setFundReturns] = useState<FundReturn[]>([]);
  const [tradingDays, setTradingDays] = useState<TradingDay[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingReturn, setEditingReturn] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [totalFundValue, setTotalFundValue] = useState(0);
  const [editingFundValue, setEditingFundValue] = useState(false);
  const [newFundValue, setNewFundValue] = useState('');
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [showMonthValuesModal, setShowMonthValuesModal] = useState(false);
  const [monthValuesData, setMonthValuesData] = useState<Record<number, { beginningValue: string; ownershipPercentage: string }>>({});
  const [selectedMonthYear, setSelectedMonthYear] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [editUserData, setEditUserData] = useState({
    firstName: '',
    lastName: '',
    beginningValue: '',
    ownershipPercentage: ''
  });

  // New user form
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    ownershipPercentage: ''
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
    loadFundSettings();
  }, [router]);

  useEffect(() => {
    loadFundReturns();
    loadTradingCalendar();
  }, [selectedDate]);

  const loadFundSettings = async () => {
    const res = await fetch('/api/fund-settings');
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        setTotalFundValue(data.settings.total_fund_value);
      }
    }
  };

  useEffect(() => {
    if (users.length > 0 && tradingDays.length > 0) {
      calculateUserSummaries();
    }
  }, [fundReturns, users, tradingDays]);

  const loadUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
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
      setTradingDays([...data.days]);
    }
  };

  const loadFundReturns = async () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const res = await fetch(`/api/fund-returns?year=${year}&month=${month}&t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      setFundReturns([...data.returns]);
    }
  };

  const handleUpdateFundValue = async () => {
    const res = await fetch('/api/fund-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalFundValue: parseFloat(newFundValue)
      }),
    });

    if (res.ok) {
      setTotalFundValue(parseFloat(newFundValue));
      setEditingFundValue(false);
      calculateUserSummaries();
      alert('Fund value updated successfully!');
    } else {
      alert('Failed to update fund value');
    }
  };

  const calculateUserSummaries = async () => {
    if (totalFundValue === 0) return;

    const tradingDates = new Set(tradingDays.map(day => day.date));
    const validReturns = fundReturns.filter(ret => tradingDates.has(ret.date));

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;

    // Load monthly beginning values for current month
    const monthlyValuesPromises = users.map(user =>
      fetch(`/api/month-values?userId=${user.id}&year=${year}&month=${month}`).then(r => r.json())
    );
    const monthlyValuesResults = await Promise.all(monthlyValuesPromises);

    const summaries = users.map((user, idx) => {
      const monthlyValue = monthlyValuesResults[idx]?.value;

      // Use monthly beginning value if available, otherwise calculate from total fund
      const userBeginningValue = monthlyValue
        ? monthlyValue.beginning_value
        : totalFundValue * (user.ownership_percentage / 100);

      let currentValue = userBeginningValue;

      for (const fundReturn of validReturns) {
        // Calculate user's share of the fund's dollar change based on ownership %
        const userShare = fundReturn.dollar_change * (user.ownership_percentage / 100);
        currentValue += userShare;
      }

      const change = currentValue - userBeginningValue;
      const percentChange = userBeginningValue !== 0 ? (change / userBeginningValue) * 100 : 0;

      return {
        user,
        currentValue,
        change,
        percentChange
      };
    });

    setUserSummaries(summaries);
  };

  const handlePreviousMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if adding this user would exceed 100% ownership
    const currentTotalOwnership = users.reduce((sum, u) => sum + u.ownership_percentage, 0);
    const newOwnership = parseFloat(newUser.ownershipPercentage);
    const totalAfterAdd = currentTotalOwnership + newOwnership;

    if (totalAfterAdd > 100) {
      alert(`Cannot add user: Total ownership would be ${totalAfterAdd.toFixed(1)}% (exceeds 100%). Current allocation: ${currentTotalOwnership.toFixed(1)}%, Available: ${(100 - currentTotalOwnership).toFixed(1)}%`);
      return;
    }

    // Calculate beginning value based on ownership and total fund
    const beginningValue = totalFundValue * (newOwnership / 100);

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUser.username,
        password: newUser.password,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        beginningValue: beginningValue,
        ownershipPercentage: newOwnership
      }),
    });

    if (res.ok) {
      setNewUser({ username: '', password: '', firstName: '', lastName: '', ownershipPercentage: '' });
      setShowUserForm(false);
      loadUsers();
      alert('User created successfully!');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (id: number) => {
    const newOwnership = parseFloat(editUserData.ownershipPercentage);

    // Check if updating this user would exceed 100% ownership
    // Calculate total excluding the user being edited
    const currentUser = users.find(u => u.id === id);
    const otherUsersOwnership = users
      .filter(u => u.id !== id)
      .reduce((sum, u) => sum + u.ownership_percentage, 0);
    const totalAfterUpdate = otherUsersOwnership + newOwnership;

    if (totalAfterUpdate > 100) {
      alert(`Cannot update user: Total ownership would be ${totalAfterUpdate.toFixed(1)}% (exceeds 100%). Other users: ${otherUsersOwnership.toFixed(1)}%, Available: ${(100 - otherUsersOwnership).toFixed(1)}%`);
      return;
    }

    // Calculate beginning value based on ownership and total fund
    const beginningValue = totalFundValue * (newOwnership / 100);

    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        firstName: editUserData.firstName,
        lastName: editUserData.lastName,
        beginningValue: beginningValue,
        ownershipPercentage: newOwnership
      }),
    });

    if (res.ok) {
      setEditingUser(null);
      loadUsers();
      alert('User updated successfully!');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user? All their data will be lost.')) return;

    const res = await fetch(`/api/users?id=${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      loadUsers();
      alert('User deleted successfully!');
    }
  };

  const handleAddReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    const dollarChange = parseFloat(newReturn.dollarChange);

    const res = await fetch('/api/fund-returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: newReturn.date,
        dollarChange: dollarChange,
        totalFundValue: totalFundValue  // Use the current total fund value
      }),
    });

    if (res.ok) {
      setNewReturn({
        date: new Date().toISOString().split('T')[0],
        dollarChange: ''
      });
      await loadFundReturns();
      alert('Return added successfully!');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to add return');
    }
  };

  const handleDeleteReturn = async (id: number) => {
    if (!confirm('Are you sure you want to delete this return?')) return;

    const res = await fetch(`/api/fund-returns?id=${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      loadFundReturns();
    }
  };

  const handleEditReturn = async (returnId: number, dollarChange: string) => {
    const fundReturn = fundReturns.find(r => r.id === returnId);
    if (!fundReturn) return;

    const res = await fetch('/api/fund-returns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: returnId,
        dollarChange: parseFloat(dollarChange),
        totalFundValue: fundReturn.total_fund_value
      }),
    });

    if (res.ok) {
      setEditingReturn(null);
      setEditValue('');
      loadFundReturns();
    }
  };

  const handleOpenMonthValues = () => {
    // Initialize with current user values
    const initialData: Record<number, { beginningValue: string; ownershipPercentage: string }> = {};
    users.forEach(user => {
      const summary = userSummaries.find(s => s.user.id === user.id);
      initialData[user.id] = {
        beginningValue: summary ? summary.currentValue.toFixed(2) : user.beginning_value.toFixed(2),
        ownershipPercentage: user.ownership_percentage.toString()
      };
    });
    setMonthValuesData(initialData);

    // Set to next month
    const nextMonth = selectedDate.getMonth() + 2; // +1 for current month, +1 for next
    const nextYear = nextMonth > 12 ? selectedDate.getFullYear() + 1 : selectedDate.getFullYear();
    const adjustedMonth = nextMonth > 12 ? 1 : nextMonth;

    setSelectedMonthYear({ year: nextYear, month: adjustedMonth });
    setShowMonthValuesModal(true);
  };

  const handleSaveMonthValues = async () => {
    try {
      // Calculate total fund value from all user beginning values
      const totalNextMonthFund = users.reduce((sum, user) => {
        const values = monthValuesData[user.id];
        return sum + (values ? parseFloat(values.beginningValue) : 0);
      }, 0);

      if (totalNextMonthFund === 0) {
        alert('Cannot save: Total fund value is $0. Please enter beginning values.');
        return;
      }

      // Calculate ownership percentages from beginning values
      for (const user of users) {
        const values = monthValuesData[user.id];
        if (values) {
          const beginningValue = parseFloat(values.beginningValue);
          const ownershipPercentage = (beginningValue / totalNextMonthFund) * 100;

          await fetch('/api/month-values', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              year: selectedMonthYear.year,
              month: selectedMonthYear.month,
              beginningValue: beginningValue,
              ownershipPercentage: ownershipPercentage
            }),
          });
        }
      }

      // Update the global fund value for next month
      await fetch('/api/fund-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalFundValue: totalNextMonthFund
        }),
      });

      alert(`Month values saved successfully! Total fund updated to $${totalNextMonthFund.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      setShowMonthValuesModal(false);
      loadFundSettings(); // Reload to show updated fund value
    } catch (error) {
      alert('Failed to save month values');
    }
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
  const returnsByDate = fundReturns.reduce((acc, ret) => {
    acc[ret.date] = ret;
    return acc;
  }, {} as Record<string, FundReturn>);

  // Merge trading days with returns
  const dailyData = tradingDays.map(day => ({
    date: day.date,
    isHalfDay: day.is_half_day === 1,
    return: returnsByDate[day.date] || null,
    isValid: true
  }));

  // Add non-trading day returns at the end
  const tradingDates = new Set(tradingDays.map(day => day.date));
  const nonTradingReturns = fundReturns.filter(ret => !tradingDates.has(ret.date));

  for (const ret of nonTradingReturns) {
    dailyData.push({
      date: ret.date,
      isHalfDay: false,
      return: ret,
      isValid: false
    });
  }

  dailyData.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate cumulative return percentage for the fund
  let cumulativeFundValue = totalFundValue;
  const dailyDataWithCumulative = dailyData.map(day => {
    if (day.return && day.isValid) {
      cumulativeFundValue += day.return.dollar_change;
    }
    const cumulativeReturnPct = totalFundValue !== 0
      ? ((cumulativeFundValue - totalFundValue) / totalFundValue) * 100
      : 0;

    return {
      ...day,
      cumulativeReturnPct: day.return && day.isValid ? cumulativeReturnPct : null,
      runningFundValue: day.return && day.isValid ? cumulativeFundValue : null
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
              onClick={handleOpenMonthValues}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
            >
              Set Next Month Values
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Month Values Modal */}
        {showMonthValuesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Set Monthly Beginning Values</h2>

              {/* Month/Year Selector */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm text-gray-700 font-semibold mb-2">Select Month & Year</label>
                <div className="flex gap-4">
                  <select
                    value={selectedMonthYear.month}
                    onChange={(e) => setSelectedMonthYear({ ...selectedMonthYear, month: parseInt(e.target.value) })}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value={1}>January</option>
                    <option value={2}>February</option>
                    <option value={3}>March</option>
                    <option value={4}>April</option>
                    <option value={5}>May</option>
                    <option value={6}>June</option>
                    <option value={7}>July</option>
                    <option value={8}>August</option>
                    <option value={9}>September</option>
                    <option value={10}>October</option>
                    <option value={11}>November</option>
                    <option value={12}>December</option>
                  </select>
                  <select
                    value={selectedMonthYear.year}
                    onChange={(e) => setSelectedMonthYear({ ...selectedMonthYear, year: parseInt(e.target.value) })}
                    className="px-3 py-2 border rounded-md"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Setting values for: <strong>{new Date(selectedMonthYear.year, selectedMonthYear.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}</strong>
                </p>
              </div>

              <p className="text-sm text-gray-600 mb-2">
                Set the beginning values for the selected month. Current ending values are pre-filled.
              </p>
              <p className="text-sm text-blue-600 mb-4">
                Ownership percentages and total fund value will be calculated automatically.
              </p>

              {/* Show calculated total */}
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Total Fund (Next Month):</span>
                  <span className="text-xl font-bold text-blue-600">
                    ${users.reduce((sum, user) => {
                      const values = monthValuesData[user.id];
                      return sum + (values ? parseFloat(values.beginningValue) || 0 : 0);
                    }, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {users.map(user => {
                  const totalFund = users.reduce((sum, u) => {
                    const values = monthValuesData[u.id];
                    return sum + (values ? parseFloat(values.beginningValue) || 0 : 0);
                  }, 0);
                  const userValue = parseFloat(monthValuesData[user.id]?.beginningValue) || 0;
                  const calculatedOwnership = totalFund > 0 ? (userValue / totalFund) * 100 : 0;

                  return (
                    <div key={user.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-2">{user.first_name} {user.last_name}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Beginning Value</label>
                          <input
                            type="number"
                            step="0.01"
                            value={monthValuesData[user.id]?.beginningValue || ''}
                            onChange={(e) => setMonthValuesData({
                              ...monthValuesData,
                              [user.id]: {
                                ...monthValuesData[user.id],
                                beginningValue: e.target.value,
                                ownershipPercentage: '' // Not used anymore
                              }
                            })}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Ownership % (calculated)</label>
                          <input
                            type="text"
                            value={`${calculatedOwnership.toFixed(2)}%`}
                            className="w-full px-3 py-2 border rounded-md bg-gray-100"
                            disabled
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSaveMonthValues}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Save Month Values
                </button>
                <button
                  onClick={() => setShowMonthValuesModal(false)}
                  className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New User Form */}
        {showUserForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Create New User</h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                placeholder="Ownership % (e.g., 10 for 10%)"
                value={newUser.ownershipPercentage}
                onChange={(e) => setNewUser({ ...newUser, ownershipPercentage: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 md:col-span-2 lg:col-span-5"
              >
                Create User
              </button>
            </form>
          </div>
        )}

        {/* Fund Overview */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Fund Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Total Fund Value (Beginning)</p>
              {editingFundValue ? (
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    value={newFundValue}
                    onChange={(e) => setNewFundValue(e.target.value)}
                    className="px-3 py-1 border rounded-md w-full"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateFundValue}
                    className="text-green-600 hover:text-green-800 text-sm whitespace-nowrap"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingFundValue(false)}
                    className="text-gray-600 hover:text-gray-800 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-2xl font-bold text-blue-600">
                    ${totalFundValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <button
                    onClick={() => {
                      setEditingFundValue(true);
                      setNewFundValue(totalFundValue.toString());
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-green-600">{users.length}</p>
            </div>
            <div className={`p-4 rounded-lg ${
              users.reduce((sum, u) => sum + u.ownership_percentage, 0) > 100
                ? 'bg-red-50'
                : users.reduce((sum, u) => sum + u.ownership_percentage, 0) > 95
                ? 'bg-yellow-50'
                : 'bg-purple-50'
            }`}>
              <p className="text-sm text-gray-600">Ownership Allocated</p>
              <p className={`text-2xl font-bold ${
                users.reduce((sum, u) => sum + u.ownership_percentage, 0) > 100
                  ? 'text-red-600'
                  : users.reduce((sum, u) => sum + u.ownership_percentage, 0) > 95
                  ? 'text-yellow-600'
                  : 'text-purple-600'
              }`}>
                {users.reduce((sum, u) => sum + u.ownership_percentage, 0).toFixed(1)}%
              </p>
              {users.reduce((sum, u) => sum + u.ownership_percentage, 0) > 100 && (
                <p className="text-xs text-red-600 mt-1">⚠️ Exceeds 100%!</p>
              )}
              {users.reduce((sum, u) => sum + u.ownership_percentage, 0) > 95 && users.reduce((sum, u) => sum + u.ownership_percentage, 0) <= 100 && (
                <p className="text-xs text-yellow-600 mt-1">⚠️ Near limit</p>
              )}
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">User Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => {
              const isEditing = editingUser === user.id;
              const summary = userSummaries.find(s => s.user.id === user.id);

              return (
                <div
                  key={user.id}
                  className="p-4 border-2 rounded-lg border-gray-200"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editUserData.firstName}
                        onChange={(e) => setEditUserData({ ...editUserData, firstName: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="First Name"
                      />
                      <input
                        type="text"
                        value={editUserData.lastName}
                        onChange={(e) => setEditUserData({ ...editUserData, lastName: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="Last Name"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={editUserData.ownershipPercentage}
                        onChange={(e) => setEditUserData({ ...editUserData, ownershipPercentage: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="Ownership %"
                      />
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleUpdateUser(user.id)}
                          className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="flex-1 bg-gray-400 text-white px-3 py-1 rounded text-sm hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="font-semibold text-lg">{user.first_name} {user.last_name}</h3>
                        <p className="text-sm text-gray-600">@{user.username}</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-800">
                            Beginning: ${(totalFundValue * (user.ownership_percentage / 100)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm text-gray-800">
                            Ownership: {user.ownership_percentage}%
                          </p>
                          {summary && (
                            <>
                              <p className={`text-sm font-semibold ${summary.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Current: ${summary.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                              <p className={`text-sm ${summary.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {summary.change >= 0 ? '+' : ''}${summary.change.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                ({summary.percentChange >= 0 ? '+' : ''}{summary.percentChange.toFixed(1)}%)
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            setEditingUser(user.id);
                            setEditUserData({
                              firstName: user.first_name,
                              lastName: user.last_name,
                              beginningValue: '',
                              ownershipPercentage: user.ownership_percentage.toString()
                            });
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add New Fund Return Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Fund Return</h2>
          <form onSubmit={handleAddReturn} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={newReturn.date}
                onChange={(e) => setNewReturn({ ...newReturn, date: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Dollar Change</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g., 1500 or -500"
                value={newReturn.dollarChange}
                onChange={(e) => setNewReturn({ ...newReturn, dollarChange: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Fund Value (auto)</label>
              <input
                type="text"
                value={`$${totalFundValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                className="w-full px-3 py-2 border rounded-md bg-gray-100"
                disabled
              />
            </div>
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
            >
              Add Return
            </button>
          </form>
        </div>

        {/* Fund Returns Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Fund Daily Returns
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
                  <th className="px-4 py-2 text-right">Dollar Change ($)</th>
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

                  const dailyReturnPct = day.return && day.return.total_fund_value !== 0
                    ? (day.return.dollar_change / day.return.total_fund_value) * 100
                    : null;

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
                          <span className={`font-medium ${day.return.dollar_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {day.return.dollar_change >= 0 ? '+' : ''}
                            ${day.return.dollar_change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${
                        dailyReturnPct === null ? 'text-gray-400' :
                        dailyReturnPct >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {dailyReturnPct !== null ? (
                          <>{dailyReturnPct >= 0 ? '+' : ''}{dailyReturnPct.toFixed(1)}%</>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${
                        day.cumulativeReturnPct === null ? 'text-gray-400' :
                        day.cumulativeReturnPct >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {day.cumulativeReturnPct !== null ? (
                          <>{day.cumulativeReturnPct >= 0 ? '+' : ''}{day.cumulativeReturnPct.toFixed(1)}%</>
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
                                    setEditValue(day.return!.dollar_change.toFixed(2));
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
      </div>
    </div>
  );
}
