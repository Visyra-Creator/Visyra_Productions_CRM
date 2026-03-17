import * as shootsService from './shoots';
import * as clientsService from './clients';
import * as appOptionsService from './appOptions';

interface OptionDefault {
  label: string;
  value: string;
}

export interface ShootsPageShoot {
  [key: string]: any;
}

export interface ShootsPageClient {
  [key: string]: any;
}

export interface ShootsPageOption {
  id: number;
  type: string;
  label: string;
  value: string;
}

export interface ShootsPageData {
  shoots: ShootsPageShoot[];
  clients: ShootsPageClient[];
  eventTypes: ShootsPageOption[];
  shootStatuses: ShootsPageOption[];
}

export async function fetchShootEventTypes(): Promise<ShootsPageOption[]> {
  const latestOptions = await appOptionsService.getAll();
  return latestOptions
    .filter((option) => option.type === 'event_type')
    .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as ShootsPageOption[];
}

export async function createShootEventType(label: string): Promise<ShootsPageOption | null> {
  const createdOrExisting = await appOptionsService.createIfNotExists('event_type', label);
  return (createdOrExisting as ShootsPageOption | null) ?? null;
}

export async function fetchShootsPageData(params: {
  shootStatusesDefaults: OptionDefault[];
}): Promise<ShootsPageData> {
  const { shootStatusesDefaults } = params;

  const allOptions = await appOptionsService.getAll();
  const existingStatuses = allOptions.filter((option) => option.type === 'shoot_status');
  if (existingStatuses.length === 0) {
    for (const status of shootStatusesDefaults) {
      await appOptionsService.create({
        type: 'shoot_status',
        label: status.label,
        value: status.value,
      });
    }
  }

  const [shootResult, clientResult, latestOptions] = await Promise.all([
    shootsService.getAll(),
    clientsService.getAll(),
    appOptionsService.getAll(),
  ]);

  const clientsById = new Map(clientResult.map((client: any) => [String(client.id), client]));

  const shoots = shootResult
    .map((shoot: any) => ({
      ...shoot,
      client_name: clientsById.get(String(shoot.client_id))?.name ?? '',
    }))
    .sort((a: any, b: any) => String(a.shoot_date ?? '').localeCompare(String(b.shoot_date ?? '')));

  return {
    shoots,
    clients: [...clientResult].sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
    eventTypes: latestOptions
      .filter((option) => option.type === 'event_type')
      .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? ''))) as ShootsPageOption[],
    shootStatuses: latestOptions
      .filter((option) => option.type === 'shoot_status')
      .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)) as ShootsPageOption[],
  };
}

