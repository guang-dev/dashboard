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
  beginningValue: number;
  displayOwnership: number;
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
  const [displayedFundValue, setDisplayedFundValue] = useState(0);
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
    beginningValue: '',
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1
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
    const tradingDates = new Set(tradingDays.map(day => day.date));
    const validReturns = fundReturns.filter(ret => tradingDates.has(ret.date));

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;

    // Get fund settings to determine current month
    const settingsRes = await fetch('/api/fund-settings');
    const settingsData = await settingsRes.json();
    const currentMonthYear = settingsData.settings?.current_month_year || '2025-10';
    const [currentYear, currentMonth] = currentMonthYear.split('-').map(Number);

    const isCurrentMonth = year === currentYear && month === currentMonth;

    // Load monthly beginning values for selected month
    const monthlyValuesPromises = users.map(user =>
      fetch(`/api/month-values?userId=${user.id}&year=${year}&month=${month}`).then(r => r.json())
    );
    const monthlyValuesResults = await Promise.all(monthlyValuesPromises);

    // Check if any users have monthly values for this month
    const hasMonthlyValues = monthlyValuesResults.some(result => result?.value);

    // Calculate display total fund
    let displayTotalFund = 0;
    if (hasMonthlyValues) {
      // If monthly values exist, sum them
      displayTotalFund = monthlyValuesResults.reduce((sum, result) => {
        return sum + (result?.value?.beginning_value || 0);
      }, 0);
    } else if (isCurrentMonth) {
      // If it's current month without monthly values, use user beginning_value
      displayTotalFund = users.reduce((sum, user) => sum + user.beginning_value, 0);
    }
    // Otherwise displayTotalFund stays 0 for future months

    const summaries = users.map((user, idx) => {
      const monthlyValue = monthlyValuesResults[idx]?.value;

      let userBeginningValue = 0;
      let ownershipPct = 0;

      if (monthlyValue) {
        // Use monthly value if set
        userBeginningValue = monthlyValue.beginning_value;
        ownershipPct = monthlyValue.ownership_percentage;
      } else if (isCurrentMonth) {
        // Use user's beginning_value for current month
        userBeginningValue = user.beginning_value;
        ownershipPct = user.ownership_percentage;
      }
      // Otherwise stays 0 for future months

      let currentValue = userBeginningValue;

      for (const fundReturn of validReturns) {
        // Use the appropriate ownership percentage (monthly if available, otherwise user's)
        const userShare = fundReturn.dollar_change * (ownershipPct / 100);
        currentValue += userShare;
      }

      const change = currentValue - userBeginningValue;
      const percentChange = userBeginningValue !== 0 ? (change / userBeginningValue) * 100 : 0;

      return {
        user,
        currentValue,
        change,
        percentChange,
        beginningValue: userBeginningValue,
        displayOwnership: ownershipPct
      };
    });

    setUserSummaries(summaries);

    // Update displayed total fund value
    setDisplayedFundValue(displayTotalFund);
  };

  const handlePreviousMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const beginningValue = parseFloat(newUser.beginningValue);
    const startYear = newUser.startYear;
    const startMonth = newUser.startMonth;

    // Get fund settings to determine current month
    const settingsRes = await fetch('/api/fund-settings');
    const settingsData = await settingsRes.json();
    const currentMonthYear = settingsData.settings?.current_month_year || '2025-10';
    const [currentYear, currentMonth] = currentMonthYear.split('-').map(Number);
    const isStartingInCurrentMonth = startYear === currentYear && startMonth === currentMonth;

    // Calculate ownership percentage upfront
    let initialOwnership = 0;
    let initialBeginningValue = 0;
    if (isStartingInCurrentMonth) {
      const currentTotalFund = users.reduce((sum, u) => sum + u.beginning_value, 0) + beginningValue;
      initialOwnership = (beginningValue / currentTotalFund) * 100;
      initialBeginningValue = beginningValue;
    }

    // Create user with correct beginning value and ownership
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUser.username,
        password: newUser.password,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        beginningValue: initialBeginningValue,
        ownershipPercentage: initialOwnership
      }),
    });

    if (res.ok) {
      const userData = await res.json();
      const newUserId = userData.id;

      if (isStartingInCurrentMonth) {
        // Recalculate ownership for existing users
        const currentTotalFund = users.reduce((sum, u) => sum + u.beginning_value, 0) + beginningValue;

        for (const user of users) {
          const updatedOwnership = (user.beginning_value / currentTotalFund) * 100;
          await fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: user.id,
              firstName: user.first_name,
              lastName: user.last_name,
              beginningValue: user.beginning_value,
              ownershipPercentage: updatedOwnership
            }),
          });
        }
      } else {
        // Create monthly value for the starting month
        // Get existing monthly values for that month
        const monthlyValuesPromises = users.map(user =>
          fetch(`/api/month-values?userId=${user.id}&year=${startYear}&month=${startMonth}`).then(r => r.json())
        );
        const monthlyValuesResults = await Promise.all(monthlyValuesPromises);

        // Calculate new total fund
        let newTotalFund = beginningValue;
        for (let i = 0; i < users.length; i++) {
          const monthlyValue = monthlyValuesResults[i]?.value;
          newTotalFund += monthlyValue?.beginning_value || 0;
        }

        // Create monthly value for new user
        const newOwnership = (beginningValue / newTotalFund) * 100;
        await fetch('/api/month-values', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: newUserId,
            year: startYear,
            month: startMonth,
            beginningValue: beginningValue,
            ownershipPercentage: newOwnership
          }),
        });

        // Recalculate ownership for all other users in that month
        for (let i = 0; i < users.length; i++) {
          const monthlyValue = monthlyValuesResults[i]?.value;
          if (monthlyValue) {
            const updatedOwnership = (monthlyValue.beginning_value / newTotalFund) * 100;
            await fetch('/api/month-values', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: users[i].id,
                year: startYear,
                month: startMonth,
                beginningValue: monthlyValue.beginning_value,
                ownershipPercentage: updatedOwnership
              }),
            });
          }
        }
      }

      setNewUser({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        beginningValue: '',
        startYear: new Date().getFullYear(),
        startMonth: new Date().getMonth() + 1
      });
      setShowUserForm(false);
      loadUsers();
      calculateUserSummaries();
      alert('User created successfully!');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (id: number) => {
    const beginningValue = parseFloat(editUserData.beginningValue);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;

    // Get fund settings to determine current month
    const settingsRes = await fetch('/api/fund-settings');
    const settingsData = await settingsRes.json();
    const currentMonthYear = settingsData.settings?.current_month_year || '2025-10';
    const [currentYear, currentMonth] = currentMonthYear.split('-').map(Number);
    const isCurrentMonth = year === currentYear && month === currentMonth;

    // Get all user summaries to find current beginning values for this month
    const monthlyValuesPromises = users.map(user =>
      fetch(`/api/month-values?userId=${user.id}&year=${year}&month=${month}`).then(r => r.json())
    );
    const monthlyValuesResults = await Promise.all(monthlyValuesPromises);

    // Calculate new total fund
    let newTotalFund = beginningValue;
    for (let i = 0; i < users.length; i++) {
      if (users[i].id !== id) {
        const monthlyValue = monthlyValuesResults[i]?.value;
        const userBeginningValue = monthlyValue
          ? monthlyValue.beginning_value
          : (isCurrentMonth ? users[i].beginning_value : 0);
        newTotalFund += userBeginningValue;
      }
    }

    if (isCurrentMonth) {
      // Update user profile (October values)
      const newOwnership = (beginningValue / newTotalFund) * 100;

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
        // Recalculate ownership percentages for ALL users
        for (const user of users) {
          if (user.id !== id) {
            const updatedOwnership = (user.beginning_value / newTotalFund) * 100;
            await fetch('/api/users', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                beginningValue: user.beginning_value,
                ownershipPercentage: updatedOwnership
              }),
            });
          }
        }
      }
    } else {
      // Update/create monthly values for this specific month
      const newOwnership = (beginningValue / newTotalFund) * 100;

      // Save monthly value for edited user
      await fetch('/api/month-values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: id,
          year,
          month,
          beginningValue: beginningValue,
          ownershipPercentage: newOwnership
        }),
      });

      // Recalculate and save monthly values for all other users
      for (let i = 0; i < users.length; i++) {
        if (users[i].id !== id) {
          const monthlyValue = monthlyValuesResults[i]?.value;
          const userBeginningValue = monthlyValue?.beginning_value || 0;

          if (userBeginningValue > 0 || monthlyValue) {
            const updatedOwnership = (userBeginningValue / newTotalFund) * 100;
            await fetch('/api/month-values', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: users[i].id,
                year,
                month,
                beginningValue: userBeginningValue,
                ownershipPercentage: updatedOwnership
              }),
            });
          }
        }
      }

      // Also update user profile (name changes)
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          firstName: editUserData.firstName,
          lastName: editUserData.lastName,
          beginningValue: users.find(u => u.id === id)!.beginning_value,
          ownershipPercentage: users.find(u => u.id === id)!.ownership_percentage
        }),
      });
    }

    // Update all fund returns for this month to use the new total fund value
    const returnsRes = await fetch(`/api/fund-returns?year=${year}&month=${month}`);
    if (returnsRes.ok) {
      const returnsData = await returnsRes.json();
      for (const fundReturn of returnsData.returns) {
        await fetch('/api/fund-returns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: fundReturn.id,
            dollarChange: fundReturn.dollar_change,
            totalFundValue: newTotalFund
          }),
        });
      }
    }

    setEditingUser(null);
    loadUsers();
    loadFundReturns();
    calculateUserSummaries();
    alert('User updated successfully!');
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
        totalFundValue: displayedFundValue  // Use the displayed (calculated) fund value
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

  const handleInitCalendar = async () => {
    const res = await fetch('/api/admin/init-calendar', {
      method: 'POST',
    });

    if (res.ok) {
      const data = await res.json();
      alert(data.message + (data.inserted ? `\nInserted ${data.inserted} trading days` : ''));
      loadTradingCalendar();
    } else {
      const error = await res.json();
      alert('Error: ' + error.error);
    }
  };

  const handleCheckCalendar = async () => {
    const res = await fetch('/api/admin/init-calendar');
    if (res.ok) {
      const data = await res.json();
      alert(`Trading calendar has ${data.count} days.\nFirst 10 dates: ${data.sample.map((d: any) => d.date).join(', ')}`);
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
      // Calculate total fund from all user beginning values
      const totalFund = users.reduce((sum, user) => {
        const values = monthValuesData[user.id];
        return sum + (values ? parseFloat(values.beginningValue) || 0 : 0);
      }, 0);

      // Save monthly values with calculated ownership percentages
      for (const user of users) {
        const values = monthValuesData[user.id];
        if (values) {
          const beginningValue = parseFloat(values.beginningValue);
          const ownershipPercentage = totalFund > 0 ? (beginningValue / totalFund) * 100 : 0;

          await fetch('/api/month-values', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              year: selectedMonthYear.year,
              month: selectedMonthYear.month,
              beginningValue: beginningValue,
              ownershipPercentage: ownershipPercentage // Calculate from beginning values
            }),
          });
        }
      }

      alert(`Month values saved successfully for ${new Date(selectedMonthYear.year, selectedMonthYear.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}!`);
      setShowMonthValuesModal(false);
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
  let cumulativeFundValue = displayedFundValue;
  const dailyDataWithCumulative = dailyData.map(day => {
    if (day.return && day.isValid) {
      cumulativeFundValue += day.return.dollar_change;
    }
    const cumulativeReturnPct = displayedFundValue !== 0
      ? ((cumulativeFundValue - displayedFundValue) / displayedFundValue) * 100
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
                  // Calculate ownership % based on beginning values
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
                                ownershipPercentage: user.ownership_percentage.toString()
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
                placeholder="Beginning Value (e.g., 2600)"
                value={newUser.beginningValue}
                onChange={(e) => setNewUser({ ...newUser, beginningValue: e.target.value })}
                className="px-3 py-2 border rounded-md"
                required
              />
              <select
                value={newUser.startMonth}
                onChange={(e) => setNewUser({ ...newUser, startMonth: parseInt(e.target.value) })}
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
                value={newUser.startYear}
                onChange={(e) => setNewUser({ ...newUser, startYear: parseInt(e.target.value) })}
                className="px-3 py-2 border rounded-md"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">Fund Overview</h2>
            <div className="flex gap-2">
              <button
                onClick={handleCheckCalendar}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
              >
                Check Calendar
              </button>
              <button
                onClick={handleInitCalendar}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                Init Calendar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Beginning Value</p>
              <p className="text-2xl font-bold text-blue-600">
                ${displayedFundValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Current Value</p>
              <p className="text-2xl font-bold text-green-600">
                ${userSummaries.reduce((sum, s) => sum + s.currentValue, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${
              userSummaries.reduce((sum, s) => sum + s.change, 0) >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <p className="text-sm text-gray-600 mb-2">Monthly Change</p>
              <p className={`text-2xl font-bold ${
                userSummaries.reduce((sum, s) => sum + s.change, 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {userSummaries.reduce((sum, s) => sum + s.change, 0) >= 0 ? '+' : ''}${userSummaries.reduce((sum, s) => sum + s.change, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className={`text-xs mt-1 ${
                userSummaries.reduce((sum, s) => sum + s.change, 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {displayedFundValue > 0 ? (
                  <>{userSummaries.reduce((sum, s) => sum + s.change, 0) >= 0 ? '+' : ''}{((userSummaries.reduce((sum, s) => sum + s.change, 0) / displayedFundValue) * 100).toFixed(1)}%</>
                ) : '0.0%'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Total Users</p>
              <p className="text-2xl font-bold text-purple-600">{users.length}</p>
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
                        value={editUserData.beginningValue}
                        onChange={(e) => setEditUserData({ ...editUserData, beginningValue: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="Beginning Value"
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
                            Beginning: ${summary?.beginningValue?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                          </p>
                          <p className="text-sm text-gray-800">
                            Ownership: {summary?.displayOwnership?.toFixed(1) || user.ownership_percentage}%
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
                              beginningValue: user.beginning_value.toString(),
                              ownershipPercentage: ''
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
                value={`$${displayedFundValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
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
