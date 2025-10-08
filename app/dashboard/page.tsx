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

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [fundReturns, setFundReturns] = useState<FundReturn[]>([]);
  const [tradingDays, setTradingDays] = useState<TradingDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [accountSummary, setAccountSummary] = useState({
    currentValue: 0,
    change: 0,
    percentChange: 0,
    monthReturn: 0,
    beginningValue: 0
  });
  const [previousMonthReturn, setPreviousMonthReturn] = useState<number | null>(null);
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

    setCurrentUser(user);

    // Load fund settings first, then load dashboard data
    const initializeDashboard = async () => {
      await loadFundSettings();
      await loadDashboardData(user, selectedDate);
    };

    initializeDashboard();
  }, [router]);

  useEffect(() => {
    if (currentUser && totalFundValue > 0) {
      loadDashboardData(currentUser, selectedDate);
      loadPreviousMonthReturn(currentUser, selectedDate);
    }
  }, [selectedDate, totalFundValue]);

  const loadFundSettings = async () => {
    const res = await fetch('/api/fund-settings');
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        setTotalFundValue(data.settings.total_fund_value);
      }
    }
  };

  const loadDashboardData = async (user: User, date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

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

    // Use monthly beginning value if available, otherwise calculate from total fund
    const userBeginningValue = monthlyValue
      ? monthlyValue.beginning_value
      : totalFundValue * (user.ownership_percentage / 100);

    // Calculate account summary after all data is loaded
    const tradingDates = new Set(days.map(day => day.date));
    const validReturns = returns.filter(ret => tradingDates.has(ret.date));

    let currentValue = userBeginningValue;

    for (const fundReturn of validReturns) {
      // Calculate user's share of the fund's dollar change based on ownership %
      const userShare = fundReturn.dollar_change * (user.ownership_percentage / 100);
      currentValue += userShare;
    }

    const change = currentValue - userBeginningValue;
    const percentChange = userBeginningValue !== 0 ? (change / userBeginningValue) * 100 : 0;

    setAccountSummary({
      currentValue,
      change,
      percentChange,
      monthReturn: percentChange,
      beginningValue: userBeginningValue
    });
  };

  const loadPreviousMonthReturn = async (user: User, date: Date) => {
    // Get previous month
    const prevMonth = date.getMonth(); // Current month is already +1, so this gives us previous
    const prevYear = prevMonth === 0 ? date.getFullYear() - 1 : date.getFullYear();
    const adjustedPrevMonth = prevMonth === 0 ? 12 : prevMonth;

    try {
      const [returnsRes, calendarRes, monthlyValueRes] = await Promise.all([
        fetch(`/api/fund-returns?year=${prevYear}&month=${adjustedPrevMonth}&t=${Date.now()}`, {
          cache: 'no-store'
        }),
        fetch(`/api/calendar?year=${prevYear}&month=${adjustedPrevMonth}&t=${Date.now()}`, {
          cache: 'no-store'
        }),
        fetch(`/api/month-values?userId=${user.id}&year=${prevYear}&month=${adjustedPrevMonth}&t=${Date.now()}`, {
          cache: 'no-store'
        })
      ]);

      if (returnsRes.ok && calendarRes.ok) {
        const returnsData = await returnsRes.json();
        const calendarData = await calendarRes.json();
        const monthlyValueData = monthlyValueRes.ok ? await monthlyValueRes.json() : null;

        const tradingDates = new Set(calendarData.days.map((day: TradingDay) => day.date));
        const validReturns = returnsData.returns.filter((ret: FundReturn) => tradingDates.has(ret.date));

        // Use monthly beginning value if available, otherwise calculate from total fund
        const userBeginningValue = monthlyValueData?.value
          ? monthlyValueData.value.beginning_value
          : totalFundValue * (user.ownership_percentage / 100);

        let currentValue = userBeginningValue;

        for (const fundReturn of validReturns) {
          const userShare = fundReturn.dollar_change * (user.ownership_percentage / 100);
          currentValue += userShare;
        }

        const change = currentValue - userBeginningValue;
        const percentChange = userBeginningValue !== 0 ? (change / userBeginningValue) * 100 : 0;

        setPreviousMonthReturn(percentChange);
      } else {
        setPreviousMonthReturn(null);
      }
    } catch (error) {
      setPreviousMonthReturn(null);
    }
  };

  const handlePreviousMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    router.push('/');
  };

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
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
    fundReturn: returnsByDate[day.date] || null
  }));

  // Calculate cumulative return for each day and user's share
  // Use the same beginning value as Account Summary for consistency
  const userBeginningValue = accountSummary.beginningValue;
  let cumulativeReturn = 0;
  let runningValue = userBeginningValue;
  const dailyDataWithCumulative = dailyData.map(day => {
    if (day.fundReturn) {
      const userShare = day.fundReturn.dollar_change * (currentUser.ownership_percentage / 100);
      runningValue += userShare;
      const dayReturn = userBeginningValue !== 0 ? (userShare / userBeginningValue) * 100 : 0;
      cumulativeReturn = ((runningValue - userBeginningValue) / userBeginningValue) * 100;

      return {
        ...day,
        userDollarChange: userShare,
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
            {previousMonthReturn !== null && (
              <div className="flex justify-between items-center bg-blue-50 -mx-6 px-6 py-2">
                <span className="text-gray-600">Previous Month Return:</span>
                <span className={`font-semibold ${previousMonthReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {previousMonthReturn >= 0 ? '+' : ''}{previousMonthReturn.toFixed(1)}%
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Ownership:</span>
              <span className="font-semibold text-gray-800">
                {currentUser.ownership_percentage}%
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
                  <th className="px-4 py-2 text-right">Dollar Change</th>
                  <th className="px-4 py-2 text-right">Daily Return</th>
                  <th className="px-4 py-2 text-right">Month's Current Return</th>
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
                            <>{day.userDailyReturn >= 0 ? '+' : ''}{day.userDailyReturn.toFixed(1)}%</>
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
