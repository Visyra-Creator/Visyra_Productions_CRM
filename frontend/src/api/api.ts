import axios from 'axios';
import { getBackendApiBaseUrl } from './config';

const API_URL = getBackendApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
