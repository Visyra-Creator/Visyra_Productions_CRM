import { create } from 'zustand';

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  event_type: string;
  event_date: string;
  status: string;
}

interface Shoot {
  id: number;
  client_id: number;
  event_type: string;
  shoot_date: string;
  location: string;
  status: string;
}

interface Payment {
  id: number;
  client_id: number;
  shoot_id: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: string;
}

interface Lead {
  id: number;
  name: string;
  stage: string;
  event_type: string;
  budget: number;
}

interface DataStore {
  clients: Client[];
  shoots: Shoot[];
  payments: Payment[];
  leads: Lead[];
  refreshData: () => void;
}

export const useDataStore = create<DataStore>((set) => ({
  clients: [],
  shoots: [],
  payments: [],
  leads: [],
  refreshData: () => {
    // This will be called to refresh data from database
    set({});
  },
}));
