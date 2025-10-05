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

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dailyReturns, setDailyReturns] = useState<DailyReturn[]>([]);
  const [tradingDays, setTradingDays] = useState<TradingDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [accountSummary, setAccountSummary] = useState({
    currentValue: 0,
    change: 0,
    percentChange: 0,
    monthReturn: 0
  });

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
    loadDashboardData(user, selectedDate);
  }, [router]);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData(currentUser, selectedDate);
    }
  }, [selectedDate]);

  const loadDashboardData = async (user: User, date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // Load daily returns for this user
    const returnsRes = await fetch(`/api/returns?userId=${user.id}&year=${year}&month=${month}&t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (returnsRes.ok) {
      const data = await returnsRes.json();
      console.log('User dashboard - Loaded returns:', data.returns);
      setDailyReturns([...data.returns]);
      calculateAccountSummary(user.beginning_value, data.returns);
    }

    // Load trading calendar
    const calendarRes = await fetch(`/api/calendar?year=${year}&month=${month}&t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (calendarRes.ok) {
      const data = await calendarRes.json();
      console.log('User dashboard - Loaded calendar:', data.days);
      setTradingDays([...data.days]);
    }
  };

  const calculateAccountSummary = (beginningValue: number, returns: DailyReturn[]) => {
    // Only include returns that are on trading calendar days
    const tradingDates = new Set(tradingDays.map(day => day.date));
    const validReturns = returns.filter(ret => tradingDates.has(ret.date));

    let currentValue = beginningValue;
    let cumulativeReturn = 1;

    for (const dailyReturn of validReturns) {
      const dailyChange = currentValue * (dailyReturn.percentage / 100);
      currentValue += dailyChange;
      cumulativeReturn *= (1 + dailyReturn.percentage / 100);
    }

    const change = currentValue - beginningValue;
    const percentChange = beginningValue !== 0 ? (change / beginningValue) * 100 : 0;
    const monthReturn = (cumulativeReturn - 1) * 100;

    setAccountSummary({
      currentValue,
      change,
      percentChange,
      monthReturn
    });
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
  const returnsByDate = dailyReturns.reduce((acc, ret) => {
    acc[ret.date] = ret;
    return acc;
  }, {} as Record<string, DailyReturn>);

  // Merge trading days with returns
  const dailyData = tradingDays.map(day => ({
    date: day.date,
    isHalfDay: day.is_half_day === 1,
    percentage: returnsByDate[day.date]?.percentage || null
  }));

  // Calculate cumulative return for each day
  let cumulativeReturn = 0;
  const dailyDataWithCumulative = dailyData.map(day => {
    if (day.percentage !== null) {
      cumulativeReturn = ((1 + cumulativeReturn / 100) * (1 + day.percentage / 100) - 1) * 100;
    }
    return {
      ...day,
      cumulativeReturn: day.percentage !== null ? cumulativeReturn : null
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
                ${currentUser.beginning_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                          day.percentage === null ? 'text-gray-400' :
                          day.percentage >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {day.percentage !== null ? (
                            <>{day.percentage >= 0 ? '+' : ''}{day.percentage.toFixed(1)}%</>
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
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
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
