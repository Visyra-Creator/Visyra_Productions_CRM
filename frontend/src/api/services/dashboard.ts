import { format } from 'date-fns';
import * as shootsService from './shoots';
import * as leadsService from './leads';
import * as clientsService from './clients';
import * as paymentsService from './payments';
import * as paymentRecordsService from './paymentRecords';
import * as expensesService from './expenses';
import * as portfolioService from './portfolio';

export interface DashboardTimelineItem {
  id: string | number;
  type: 'shoot' | 'payment' | 'lead' | 'client';
  title: string;
  subtitle: string;
  date: Date;
  status?: string;
}

export interface DashboardPortfolioImage {
  id: string | number;
  image_path: string;
  portfolio_title: string;
  category: string;
}

export interface DashboardStats {
  upcomingShoots: number;
  totalLeads: number;
  totalClients: number;
  pendingPayments: number;
  outstandingBalance: number;
  monthlyRevenue: number;
  totalExpenses: number;
  monthlyProfit: number;
  todaysShoots: any[];
  todaysFollowUps: any[];
  todaysClientFollowUps: any[];
  todaysPayments: any[];
  overdueShoots: any[];
  overdueLeads: any[];
  overdueClientFollowUps: any[];
  overduePayments: any[];
}

export interface DashboardData {
  stats: DashboardStats;
  timelineData: DashboardTimelineItem[];
  recentPortfolio: DashboardPortfolioImage[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const monthPrefix = format(now, 'yyyy-MM');

  console.log('[Dashboard] Fetching data from Supabase...');
  const [shoots, leads, clients, payments, paymentRecords, expenses, portfolio] = await Promise.all([
    shootsService.getAll(),
    leadsService.getAll(),
    clientsService.getAll(),
    paymentsService.getAll(),
    paymentRecordsService.getAll(),
    expensesService.getAll(),
    portfolioService.getAll(),
  ]);

  console.log('[Dashboard] Supabase data received:', {
    shoots: shoots.length,
    leads: leads.length,
    clients: clients.length,
    payments: payments.length,
    paymentRecords: paymentRecords.length,
    expenses: expenses.length,
    portfolio: portfolio.length,
  });

  const clientsById = new Map(clients.map((c: any) => [String(c.id), c]));
  const withClientName = (row: any) => ({ ...row, client_name: clientsById.get(String(row.client_id))?.name ?? null });

  const todayShoots = shoots.filter((s: any) => s.shoot_date === todayStr).map(withClientName);
  const overdueShoots = [...shoots]
    .filter((s: any) => s.shoot_date && s.shoot_date < todayStr && s.status !== 'completed')
    .sort((a: any, b: any) => String(b.shoot_date).localeCompare(String(a.shoot_date)))
    .slice(0, 4)
    .map(withClientName);

  const todayFollowUps = leads.filter((l: any) => l.next_follow_up === todayStr);
  const overdueLeads = [...leads]
    .filter((l: any) => l.next_follow_up && l.next_follow_up < todayStr)
    .sort((a: any, b: any) => String(b.next_follow_up).localeCompare(String(a.next_follow_up)))
    .slice(0, 4);

  const todayClientFollowUps = clients.filter((c: any) => c.next_follow_up === todayStr).map((c: any) => ({ ...c, client_name: c.name }));
  const overdueClientFollowUps = [...clients]
    .filter((c: any) => c.next_follow_up && c.next_follow_up < todayStr)
    .sort((a: any, b: any) => String(b.next_follow_up).localeCompare(String(a.next_follow_up)))
    .slice(0, 4)
    .map((c: any) => ({ ...c, client_name: c.name }));

  const todayPayments = payments.filter((p: any) => p.payment_date === todayStr && p.status !== 'paid').map(withClientName);
  const overduePayments = [...payments]
    .filter((p: any) => p.payment_date && p.payment_date < todayStr && p.status !== 'paid')
    .sort((a: any, b: any) => String(b.payment_date).localeCompare(String(a.payment_date)))
    .slice(0, 4)
    .map(withClientName);

  const pendingPayments = payments.filter((p: any) => ['pending', 'partial'].includes(String(p.status)));
  const outstandingBalance = pendingPayments.reduce((sum: number, p: any) => sum + Number(p.balance || 0), 0);
  const monthlyRevenue = paymentRecords
    .filter((r: any) => String(r.payment_date || '').startsWith(monthPrefix))
    .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
  const totalExpenses = expenses
    .filter((e: any) => String(e.date || '').startsWith(monthPrefix))
    .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

  const stats: DashboardStats = {
    upcomingShoots: shoots.filter((s: any) => s.status === 'upcoming').length,
    totalLeads: leads.length,
    totalClients: clients.length,
    pendingPayments: pendingPayments.length,
    outstandingBalance,
    monthlyRevenue,
    totalExpenses,
    monthlyProfit: monthlyRevenue - totalExpenses,
    todaysShoots: todayShoots,
    todaysFollowUps: todayFollowUps,
    todaysClientFollowUps: todayClientFollowUps,
    todaysPayments: todayPayments,
    overdueShoots,
    overdueLeads,
    overdueClientFollowUps,
    overduePayments,
  };

  const timeline: DashboardTimelineItem[] = [];

  [...shoots]
    .filter((s: any) => s.shoot_date && s.shoot_date >= todayStr)
    .sort((a: any, b: any) => String(a.shoot_date).localeCompare(String(b.shoot_date)))
    .slice(0, 10)
    .forEach((s: any) => {
      timeline.push({
        id: s.id,
        type: 'shoot',
        title: `${s.event_type || 'Photoshoot'} - ${clientsById.get(String(s.client_id))?.name || '-'}`,
        subtitle: s.location || 'Location TBD',
        date: new Date(s.shoot_date),
        status: s.status,
      });
    });

  [...payments]
    .filter((p: any) => p.status !== 'paid' && p.payment_date && p.payment_date >= todayStr)
    .sort((a: any, b: any) => String(a.payment_date).localeCompare(String(b.payment_date)))
    .slice(0, 5)
    .forEach((p: any) => {
      timeline.push({
        id: p.id,
        type: 'payment',
        title: `Payment Due - ${clientsById.get(String(p.client_id))?.name || '-'}`,
        subtitle: `Amount: Rs${Number(p.total_amount || 0).toLocaleString()}`,
        date: new Date(p.payment_date),
        status: p.status,
      });
    });

  [...leads]
    .filter((l: any) => l.next_follow_up && l.next_follow_up >= todayStr)
    .sort((a: any, b: any) => String(a.next_follow_up).localeCompare(String(b.next_follow_up)))
    .slice(0, 10)
    .forEach((l: any) => {
      timeline.push({
        id: l.id,
        type: 'lead',
        title: `Follow Up - ${l.name}`,
        subtitle: l.notes || 'No notes',
        date: new Date(l.next_follow_up),
        status: 'pending',
      });
    });

  [...clients]
    .filter((c: any) => c.next_follow_up && c.next_follow_up >= todayStr)
    .sort((a: any, b: any) => String(a.next_follow_up).localeCompare(String(b.next_follow_up)))
    .slice(0, 10)
    .forEach((c: any) => {
      timeline.push({
        id: c.id,
        type: 'client',
        title: `Client Follow Up - ${c.name}`,
        subtitle: c.event_type || 'Client',
        date: new Date(c.next_follow_up),
        status: 'pending',
      });
    });

  const recentPortfolio = [...portfolio]
    .filter((p: any) => p.media_type === 'image')
    .sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, 5)
    .map((p: any) => ({
      id: p.id,
      image_path: p.file_path,
      portfolio_title: p.title,
      category: p.category,
    })) as DashboardPortfolioImage[];

  return {
    stats,
    timelineData: timeline.sort((a, b) => a.date.getTime() - b.date.getTime()),
    recentPortfolio,
  };
}

