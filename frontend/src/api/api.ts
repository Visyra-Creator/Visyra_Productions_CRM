import axios from 'axios';

const API_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api`;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
