import { isSameDay, isSameMonth, isSameWeek, parseISO } from 'date-fns';
import * as leadsService from './leads';
import * as appOptionsService from './appOptions';

interface OptionDefault {
  label: string;
  value: string;
  color: string;
}

export interface LeadsPageOption {
  id: number;
  type: string;
  label: string;
  value: string;
  color: string;
}

export interface LeadsPageLead {
  id: number;
  created_at?: string;
  [key: string]: any;
}

export interface LeadsPageStats {
  today: number;
  week: number;
  month: number;
}

export interface LeadsPageData {
  leads: LeadsPageLead[];
  leadSources: LeadsPageOption[];
  leadStages: LeadsPageOption[];
  eventTypes: LeadsPageOption[];
  stats: LeadsPageStats;
}

function parseLeadCreatedAt(createdAt: string): Date | null {
  try {
    return parseISO(createdAt.replace(' ', 'T') + 'Z');
  } catch {
    return null;
  }
}

function calculateLeadStats(leads: LeadsPageLead[]): LeadsPageStats {
  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  const today = new Date();

  leads.forEach((lead) => {
    if (!lead.created_at) return;

    const createdAt = parseLeadCreatedAt(lead.created_at);
    if (!createdAt) return;

    if (isSameDay(createdAt, today)) todayCount++;
    if (isSameWeek(createdAt, today, { weekStartsOn: 1 })) weekCount++;
    if (isSameMonth(createdAt, today)) monthCount++;
  });

  return {
    today: todayCount,
    week: weekCount,
    month: monthCount,
  };
}

function mapLeadSources(options: any[], defaults: OptionDefault[]): LeadsPageOption[] {
  const sourceOptions = options
    .filter((option) => option.type === 'lead_source')
    .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as LeadsPageOption[];

  if (sourceOptions.length > 0) {
    return sourceOptions;
  }

  return defaults.map((source, index) => ({
    id: -(index + 1),
    type: 'lead_source',
    label: source.label,
    value: source.value,
    color: source.color,
  }));
}

export async function fetchLeadsPageData(params: {
  leadStagesDefaults: OptionDefault[];
  leadSourcesDefaults: OptionDefault[];
}): Promise<LeadsPageData> {
  const { leadStagesDefaults, leadSourcesDefaults } = params;

  const allOptions = await appOptionsService.getAll();
  const existingStages = allOptions.filter((option) => option.type === 'lead_stage');

  if (existingStages.length === 0) {
    for (const stage of leadStagesDefaults) {
      await appOptionsService.create({
        type: 'lead_stage',
        label: stage.label,
        value: stage.value,
        color: stage.color,
      });
    }
  }

  const result = await leadsService.getAll();
  const leads = [...result]
    .sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))) as LeadsPageLead[];

  const refreshedOptions = await appOptionsService.getAll();

  return {
    leads,
    leadSources: mapLeadSources(refreshedOptions, leadSourcesDefaults),
    leadStages: refreshedOptions
      .filter((option) => option.type === 'lead_stage')
      .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)) as LeadsPageOption[],
    eventTypes: refreshedOptions
      .filter((option) => option.type === 'event_type')
      .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as LeadsPageOption[],
    stats: calculateLeadStats(leads),
  };
}

