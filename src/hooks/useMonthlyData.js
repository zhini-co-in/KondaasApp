// src/hooks/useMonthlyData.js
import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import MonthlyDataManager from '../utils/MonthlyDataManager';

export function useMonthlyData(stationId) {
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyDataLoading, setMonthlyDataLoading] = useState(true);

  const refreshData = async () => {
  if (!stationId) {
  console.log("Waiting for station...");
}

  try {
    await MonthlyDataManager.sync(stationId);   // 🔥 ADD THIS
    const result = await MonthlyDataManager.getAll(stationId);
      setMonthlyData(result);
      setMonthlyDataLoading(false);
    } catch (err) {
      console.error('Failed to load monthly data:', err);
      setMonthlyDataLoading(false);
    }
  };

  useEffect(() => {
  setMonthlyData(null);
  setMonthlyDataLoading(true);

  refreshData();

  const pollInterval = setInterval(() => {
    if (monthlyDataLoading) refreshData();
  }, 4000);

  const appStateSub = AppState.addEventListener('change', nextAppState => {
    if (nextAppState === 'active') {
      refreshData();
    }
  });

  return () => {
    clearInterval(pollInterval);
    appStateSub.remove();
  };
}, [stationId]);

  return { monthlyData, monthlyDataLoading };
}