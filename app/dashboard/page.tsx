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
  percent_change?: number;
}

interface TradingDay {
  date: string;
  is_half_day: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [fundReturns, setFundReturns] = useState<FundReturn[]>([]);
  const [tradingDays, setTradingDays] = useState<TradingDay[]>([]);
  const [accountSummary, setAccountSummary] = useState({
    currentValue: 0,
    change: 0,
    percentChange: 0,
    monthReturn: 0,
    beginningValue: 0,
    ownershipPercentage: 0
  });
  const [totalFundValue, setTotalFundValue] = useState(0);

  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) {
      router.push('/');
      return;
    }

    const user = JSON.parse(userStr);
    if (user.is_admin) {
      router.push('/admin');
      return;
    }

    // Load fund settings first, then reload fresh user data and load dashboard
    const initializeDashboard = async () => {
      await loadFundSettings();

      // Reload fresh user data from API
      const userRes = await fetch(`/api/users?id=${user.id}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        const freshUser = userData.user;
        setCurrentUser(freshUser);
        // Update sessionStorage with fresh data
        sessionStorage.setItem('user', JSON.stringify(freshUser));
        // For individual users, always show current month
        await loadDashboardData(freshUser, new Date());
      } else {
        // Fallback to cached user if API fails
        setCurrentUser(user);
        await loadDashboardData(user, new Date());
      }
    };

    initializeDashboard();
  }, [router]);

  const loadFundSettings = async () => {
    const res = await fetch('/api/fund-settings');
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        setTotalFundValue(data.settings.total_fund_value);
      }
    }
  };

  const loadDashboardData = async (user: User, currentDate: Date = new Date()) => {
    // For individual users, always use current date
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    // Load fund returns, calendar, and monthly beginning value in parallel
    const [returnsRes, calendarRes, monthlyValueRes] = await Promise.all([
      fetch(`/api/fund-returns?year=${year}&month=${month}&t=${Date.now()}`, {
        cache: 'no-store'
      }),
      fetch(`/api/calendar?year=${year}&month=${month}&t=${Date.now()}`, {
        cache: 'no-store'
      }),
      fetch(`/api/month-values?userId=${user.id}&year=${year}&month=${month}&t=${Date.now()}`, {
        cache: 'no-store'
      })
    ]);

    let returns: FundReturn[] = [];
    let days: TradingDay[] = [];
    let monthlyValue = null;

    if (returnsRes.ok) {
      const data = await returnsRes.json();
      returns = data.returns;
      setFundReturns([...returns]);
    }

    if (calendarRes.ok) {
      const data = await calendarRes.json();
      days = data.days;
      setTradingDays([...days]);
    }

    if (monthlyValueRes.ok) {
      const data = await monthlyValueRes.json();
      monthlyValue = data.value;
    }

    // Get fund settings to determine current month
    const settingsRes = await fetch('/api/fund-settings');
    const settingsData = await settingsRes.json();
    const currentMonthYear = settingsData.settings?.current_month_year || '2025-10';
    const [currentYear, currentMonth] = currentMonthYear.split('-').map(Number);
    const isCurrentMonth = year === currentYear && month === currentMonth;

    // Use monthly beginning value and ownership if available
    // For current month without monthly values, use user's profile values directly
    // For other months without monthly values, use 0
    let userBeginningValue = 0;
    let userOwnershipPercentage = 0;

    if (monthlyValue) {
      // Monthly value exists for this month
      userBeginningValue = monthlyValue.beginning_value;
      userOwnershipPercentage = monthlyValue.ownership_percentage;
    } else if (isCurrentMonth) {
      // Current month without monthly value - use user's profile values
      userBeginningValue = user.beginning_value;
      userOwnershipPercentage = user.ownership_percentage;
    }
    // Otherwise stays 0 for past/future months without monthly values

    // Calculate account summary after all data is loaded
    const tradingDates = new Set(days.map(day => day.date));
    const validReturns = returns.sort((a, b) => a.date.localeCompare(b.date));

    let currentValue = userBeginningValue;

    for (const fundReturn of validReturns) {
      // Calculate user's dollar change based on their prior day balance and the daily % return
      const percentChange = fundReturn.percent_change ??
        (fundReturn.total_fund_value !== 0 ? (fundReturn.dollar_change / fundReturn.total_fund_value) * 100 : 0);

      const userDollarChange = (percentChange / 100) * currentValue;
      currentValue += userDollarChange;
    }

    const change = currentValue - userBeginningValue;
    const percentChange = userBeginningValue !== 0 ? (change / userBeginningValue) * 100 : 0;

    setAccountSummary({
      currentValue,
      change,
      percentChange,
      monthReturn: percentChange,
      beginningValue: userBeginningValue,
      ownershipPercentage: userOwnershipPercentage
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    router.push('/');
  };

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Always show current month for individual users
  const currentDate = new Date();
  const monthName = currentDate.toLocaleString('en-US', { month: 'long' });
  const year = currentDate.getFullYear();

  // Create a map of returns by date
  const returnsByDate = fundReturns.reduce((acc, ret) => {
    acc[ret.date] = ret;
    return acc;
  }, {} as Record<string, FundReturn>);

  // Merge trading days with returns
  const dailyData = tradingDays.map(day => ({
    date: day.date,
    isHalfDay: day.is_half_day === 1,
    fundReturn: returnsByDate[day.date] || null
  }));

  // Calculate cumulative return for each day and user's share
  // Use the same beginning value and ownership as Account Summary for consistency
  const userBeginningValue = accountSummary.beginningValue;
  let cumulativeReturn = 0;
  let runningValue = userBeginningValue;
  const dailyDataWithCumulative = dailyData.map(day => {
    if (day.fundReturn) {
      // Calculate user's dollar change based on prior day's balance and daily % return
      const percentChange = day.fundReturn.percent_change ??
        (day.fundReturn.total_fund_value !== 0 ? (day.fundReturn.dollar_change / day.fundReturn.total_fund_value) * 100 : 0);

      const userDollarChange = (percentChange / 100) * runningValue;
      runningValue += userDollarChange;

      const dayReturn = percentChange; // The daily % return is the same for all investors
      cumulativeReturn = userBeginningValue !== 0 ? ((runningValue - userBeginningValue) / userBeginningValue) * 100 : 0;

      return {
        ...day,
        userDollarChange: userDollarChange,
        userDailyReturn: dayReturn,
        cumulativeReturn: cumulativeReturn
      };
    }

    return {
      ...day,
      userDollarChange: null,
      userDailyReturn: null,
      cumulativeReturn: null
    };
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Trading Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {/* Account Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Account Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Account Name:</span>
              <span className="font-semibold text-gray-800">
                {currentUser.first_name} {currentUser.last_name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Beginning Value:</span>
              <span className="font-semibold text-gray-800">
                ${accountSummary.beginningValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

        {/* Daily Returns */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Daily Returns
            </h2>
            <span className="text-lg font-medium text-gray-700">
              {monthName} {year}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Dollar Change ($)</th>
                  <th className="px-4 py-2 text-right">Daily Return (%)</th>
                  <th className="px-4 py-2 text-right">Month's Current Return (%)</th>
                </tr>
              </thead>
              <tbody>
                {dailyDataWithCumulative.length > 0 ? (
                  dailyDataWithCumulative.map((day, idx) => {
                    const dateObj = new Date(day.date + 'T00:00:00');
                    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const monthDay = dateObj.getDate();

                    return (
                      <tr key={idx} className="border-t">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 w-12">{dayOfWeek}</span>
                            <span className="font-medium">{monthDay}</span>
                            {day.isHalfDay && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                Half Day
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${
                          day.userDollarChange === null ? 'text-gray-400' :
                          day.userDollarChange >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {day.userDollarChange !== null ? (
                            <>{day.userDollarChange >= 0 ? '+' : ''}${day.userDollarChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${
                          day.userDailyReturn === null ? 'text-gray-400' :
                          day.userDailyReturn >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {day.userDailyReturn !== null ? (
                            <>{day.userDailyReturn >= 0 ? '+' : ''}{day.userDailyReturn.toFixed(3)}%</>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${
                          day.cumulativeReturn === null ? 'text-gray-400' :
                          day.cumulativeReturn >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {day.cumulativeReturn !== null ? (
                            <>{day.cumulativeReturn >= 0 ? '+' : ''}{day.cumulativeReturn.toFixed(3)}%</>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No trading days available for this month
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
