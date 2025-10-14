import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.example.com/', // replace with your Kondaas backend
  timeout: 15000,
});

export const setToken = (token?: string) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

export default api;
