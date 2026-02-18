// src/hooks/useMonthlyData.js
import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import MonthlyDataManager from '../utils/MonthlyDataManager';

export function useMonthlyData() {
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyDataLoading, setMonthlyDataLoading] = useState(true);

  const refreshData = async () => {
    try {
      const result = await MonthlyDataManager.getAll();
      setMonthlyData(result);
      setMonthlyDataLoading(false);
    } catch (err) {
      console.error('Failed to load monthly data:', err);
      setMonthlyDataLoading(false);
    }
  };

  useEffect(() => {
    refreshData(); // initial load

    // Poll every 4 seconds while loading (stops after data arrives)
    const pollInterval = setInterval(() => {
      if (monthlyDataLoading) refreshData();
    }, 4000);

    // Refresh on app foreground
    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        refreshData();
      }
    });

    return () => {
      clearInterval(pollInterval);
      appStateSub.remove();
    };
  }, [monthlyDataLoading]);

  return { monthlyData, monthlyDataLoading };
}