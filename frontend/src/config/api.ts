import axios from 'axios';
import { ProjectData, BusinessPlanResults } from '../hooks/useLkDescription';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const businessPlanApi = {
  calculateBusinessPlan: async (data: ProjectData): Promise<{ data: BusinessPlanResults }> => {
    return api.post('/calculate_bp', data);
  },
}; 