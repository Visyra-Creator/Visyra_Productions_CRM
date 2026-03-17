import * as paymentsService from './payments';
import * as paymentRecordsService from './paymentRecords';
import * as clientsService from './clients';
import * as shootsService from './shoots';
import * as appOptionsService from './appOptions';

interface OptionDefault {
  label: string;
  value: string;
}

export interface PaymentsPageInvoice {
  [key: string]: any;
}

export interface PaymentsPageRecord {
  [key: string]: any;
}

export interface PaymentsPageClient {
  [key: string]: any;
}

export interface PaymentsPageShoot {
  [key: string]: any;
}

export interface PaymentsPageOption {
  [key: string]: any;
}

export interface PaymentsPageData {
  invoices: PaymentsPageInvoice[];
  paymentRecords: PaymentsPageRecord[];
  clients: PaymentsPageClient[];
  shoots: PaymentsPageShoot[];
  paymentMethods: PaymentsPageOption[];
}

export async function fetchPaymentsPageData(params: {
  paymentMethodsDefaults: OptionDefault[];
}): Promise<PaymentsPageData> {
  const { paymentMethodsDefaults } = params;

  const options = await appOptionsService.getAll();
  const existingMethods = options.filter((option) => option.type === 'payment_method');
  if (existingMethods.length === 0) {
    for (const method of paymentMethodsDefaults) {
      await appOptionsService.create({ type: 'payment_method', label: method.label, value: method.value });
    }
  }

  const [inv, pr, c, s, allOptions] = await Promise.all([
    paymentsService.getAll(),
    paymentRecordsService.getAll(),
    clientsService.getAll(),
    shootsService.getAll(),
    appOptionsService.getAll(),
  ]);

  const clientsById = new Map(c.map((client: any) => [String(client.id), client]));
  const shootsById = new Map(s.map((shoot: any) => [String(shoot.id), shoot]));

  const invoices = [...inv]
    .map((payment: any) => ({
      ...payment,
      client_name: clientsById.get(String(payment.client_id))?.name ?? null,
      event_type: shootsById.get(String(payment.shoot_id))?.event_type ?? null,
    }))
    .sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));

  const paymentRecords = [...pr].sort((a: any, b: any) =>
    String(b.payment_date ?? '').localeCompare(String(a.payment_date ?? '')),
  );

  const clients = [...c].sort((a: any, b: any) =>
    String(a.name ?? '').localeCompare(String(b.name ?? '')),
  );

  const paymentMethods = allOptions
    .filter((option) => option.type === 'payment_method')
    .sort((a, b) => String(a.label ?? '').localeCompare(String(b.label ?? '')));

  return {
    invoices,
    paymentRecords,
    clients,
    shoots: s,
    paymentMethods,
  };
}

