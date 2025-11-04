// api.js
import axios from 'axios';

// 🔹 Create axios instance
const api = axios.create({
  baseURL: 'https://bipectinate-semisomnolently-cordia.ngrok-free.dev/',
  timeout: 15000,
});

export const setToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};


export const fetchHistoricalData = async (body, token) => {
  try {
    setToken(token);
    const response = await api.post('/device/v1.0/historical', body);
    return response.data;
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
};

export default api;

