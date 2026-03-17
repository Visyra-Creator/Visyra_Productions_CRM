import { parseISO, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import * as clientsService from './clients';
import * as appOptionsService from './appOptions';

export interface ClientsPageOption {
  id: number;
  type: string;
  label: string;
  value: string;
  color: string;
}

export interface ClientsPageClient {
  id: number;
  client_id?: string;
  event_date: string;
  created_at?: string;
  [key: string]: any;
}

export interface ClientsPageStats {
  today: number;
  week: number;
  month: number;
}

export interface ClientsPageData {
  clients: ClientsPageClient[];
  eventTypes: ClientsPageOption[];
  availablePackages: ClientsPageOption[];
  leadSources: ClientsPageOption[];
  clientStatuses: ClientsPageOption[];
  stats: ClientsPageStats;
}

interface OptionDefault {
  label: string;
  value: string;
  color: string;
}

function mapAndSortOptions(options: any[], type: string): ClientsPageOption[] {
  return options
    .filter((option) => option.type === type)
    .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as ClientsPageOption[];
}

function calculateStats(clients: ClientsPageClient[]): ClientsPageStats {
  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  const today = new Date();

  clients.forEach((client) => {
    if (!client.event_date) return;

    try {
      const date = parseISO(client.event_date);
      if (isSameDay(date, today)) todayCount++;
      if (isSameWeek(date, today, { weekStartsOn: 1 })) weekCount++;
      if (isSameMonth(date, today)) monthCount++;
    } catch {
      // Ignore invalid date rows; keep UI responsive.
    }
  });

  return { today: todayCount, week: weekCount, month: monthCount };
}

export async function fetchClientDropdownOptions(leadSourceDefaults: OptionDefault[]): Promise<{
  eventTypes: ClientsPageOption[];
  availablePackages: ClientsPageOption[];
  leadSources: ClientsPageOption[];
}> {
  const options = await appOptionsService.getAll();

  const eventTypes = mapAndSortOptions(options, 'event_type');
  const availablePackages = mapAndSortOptions(options, 'package');
  const leadSourceOptions = mapAndSortOptions(options, 'lead_source');

  const leadSources =
    leadSourceOptions.length > 0
      ? leadSourceOptions
      : leadSourceDefaults.map((source, index) => ({
          id: -(index + 1),
          type: 'lead_source',
          label: source.label,
          value: source.value,
          color: source.color,
        }));

  return {
    eventTypes,
    availablePackages,
    leadSources,
  };
}

export async function fetchClientsPageData(params: {
  clientStatusesDefaults: OptionDefault[];
  leadSourcesDefaults: OptionDefault[];
}): Promise<ClientsPageData> {
  const { clientStatusesDefaults, leadSourcesDefaults } = params;

  const options = await appOptionsService.getAll();

  const existingStatuses = options.filter((option) => option.type === 'client_status');
  if (existingStatuses.length === 0) {
    for (const status of clientStatusesDefaults) {
      await appOptionsService.create({
        type: 'client_status',
        label: status.label,
        value: status.value,
        color: status.color,
      });
    }
  }

  const existingLeadSources = options.filter((option) => option.type === 'lead_source');
  if (existingLeadSources.length === 0) {
    for (const source of leadSourcesDefaults) {
      await appOptionsService.create({
        type: 'lead_source',
        label: source.label,
        value: source.value,
        color: source.color,
      });
    }
  }

  const clientsRows = await clientsService.getAll();
  const clients = [...clientsRows].sort((a: any, b: any) =>
    String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')),
  ) as ClientsPageClient[];

  const refreshedOptions = await appOptionsService.getAll();
  const { eventTypes, availablePackages, leadSources } = await fetchClientDropdownOptions(leadSourcesDefaults);
  const clientStatuses = refreshedOptions
    .filter((option) => option.type === 'client_status')
    .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)) as ClientsPageOption[];

  return {
    clients,
    eventTypes,
    availablePackages,
    leadSources,
    clientStatuses,
    stats: calculateStats(clients),
  };
}

