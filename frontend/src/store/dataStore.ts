import { create } from 'zustand';
import * as clientsService from '../api/services/clients';
import * as shootsService from '../api/services/shoots';
import * as paymentsService from '../api/services/payments';
import * as leadsService from '../api/services/leads';

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
  refreshData: () => Promise<void>;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const useDataStore = create<DataStore>((set) => ({
  clients: [],
  shoots: [],
  payments: [],
  leads: [],
  refreshData: async () => {
    try {
      const [clientsRows, shootsRows, paymentsRows, leadsRows] = await Promise.all([
        clientsService.getAll(),
        shootsService.getAll(),
        paymentsService.getAll(),
        leadsService.getAll(),
      ]);

      set({
        clients: clientsRows.map((row) => ({
          id: toNumber(row.id),
          name: String(row.name ?? ''),
          phone: String(row.phone ?? ''),
          email: String(row.email ?? ''),
          event_type: String(row.event_type ?? ''),
          event_date: String(row.event_date ?? ''),
          status: String(row.status ?? ''),
        })),
        shoots: shootsRows.map((row) => ({
          id: toNumber(row.id),
          client_id: toNumber(row.client_id),
          event_type: String(row.event_type ?? ''),
          shoot_date: String(row.shoot_date ?? ''),
          location: String(row.location ?? ''),
          status: String(row.status ?? ''),
        })),
        payments: paymentsRows.map((row) => ({
          id: toNumber(row.id),
          client_id: toNumber(row.client_id),
          shoot_id: toNumber(row.shoot_id),
          total_amount: toNumber(row.total_amount),
          paid_amount: toNumber(row.paid_amount),
          balance: toNumber(row.balance),
          status: String(row.status ?? ''),
        })),
        leads: leadsRows.map((row) => ({
          id: toNumber(row.id),
          name: String(row.name ?? ''),
          stage: String(row.stage ?? ''),
          event_type: String(row.event_type ?? ''),
          budget: toNumber(row.budget),
        })),
      });
    } catch (error) {
      console.error('Failed to refresh data store from Supabase services:', error);
    }
  },
}));
