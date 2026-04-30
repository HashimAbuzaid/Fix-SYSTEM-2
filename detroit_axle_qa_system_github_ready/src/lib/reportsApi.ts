import { supabase } from './supabase';

export type FilterParams = {
  team?: string;
  agentIds?: string[];
  dateFrom?: string;
  dateTo?: string;
};

export type SummaryStats = {
  total_audits: number;
  average_quality: number;
  calls_count: number;   calls_avg: number;
  tickets_count: number; tickets_avg: number;
  sales_count: number;   sales_avg: number;
};

export type TrendBucket = {
  period_key: string;
  avg_score: number;
  audit_count: number;
};

export type RecurringIssueRow = {
  metric: string;
  total_count: number;
  borderline_count: number;
  fail_count: number;
  auto_fail_count: number;
};

function rpcParams(f: FilterParams) {
  return {
    p_team:      f.team      || null,
    p_agent_ids: f.agentIds?.length ? f.agentIds : null,
    p_date_from: f.dateFrom  || null,
    p_date_to:   f.dateTo    || null,
  };
}

/** Fast: single SQL aggregate — replaces fetching every audit row */
export async function fetchSummaryStats(f: FilterParams): Promise<SummaryStats> {
  const { data, error } = await supabase.rpc('get_reports_summary', rpcParams(f));
  if (error) throw error;
  return (data ?? {}) as SummaryStats;
}

/** Fast: bucketed averages — no full row hydration */
export async function fetchTrendBuckets(
  f: FilterParams,
  mode: 'weekly' | 'monthly'
): Promise<{ subject: TrendBucket[]; team: TrendBucket[] }> {
  const fn = mode === 'weekly' ? 'get_weekly_trend' : 'get_monthly_trend';
  // subject scope
  const subjectReq = supabase.rpc(fn, rpcParams(f));
  // team baseline (same team, no agent filter)
  const teamReq = supabase.rpc(fn, rpcParams({ team: f.team, dateFrom: f.dateFrom, dateTo: f.dateTo }));
  const [{ data: subject, error: e1 }, { data: team, error: e2 }] = await Promise.all([subjectReq, teamReq]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { subject: (subject ?? []) as TrendBucket[], team: (team ?? []) as TrendBucket[] };
}

/** Fast: server-side JSONB aggregation */
export async function fetchRecurringIssues(f: FilterParams): Promise<RecurringIssueRow[]> {
  const { data, error } = await supabase.rpc('get_recurring_issues', rpcParams(f));
  if (error) throw error;
  return (data ?? []) as RecurringIssueRow[];
}

const PAGE = 50;

/** Paginated detail rows — only fetches what the table can show */
export async function fetchAuditPage(f: FilterParams, page: number) {
  let q = supabase
    .from('audits')
    .select('id,agent_id,agent_name,team,case_type,audit_date,order_number,phone_number,ticket_id,quality_score,comments,score_details')
    .order('audit_date', { ascending: false })
    .range(page * PAGE, (page + 1) * PAGE - 1);
  if (f.team)     q = q.eq('team', f.team);
  if (f.dateFrom) q = q.gte('audit_date', f.dateFrom);
  if (f.dateTo)   q = q.lte('audit_date', f.dateTo);
  if (f.agentIds?.length) q = q.in('agent_id', f.agentIds);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchRequestPage(f: FilterParams, page: number) {
  let q = supabase
    .from('supervisor_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page * PAGE, (page + 1) * PAGE - 1);
  if (f.team)     q = q.eq('team', f.team);
  if (f.dateFrom) q = q.gte('created_at', f.dateFrom);
  if (f.dateTo)   q = q.lte('created_at', f.dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchFeedbackPage(f: FilterParams, page: number) {
  let q = supabase
    .from('agent_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page * PAGE, (page + 1) * PAGE - 1);
  if (f.team)     q = q.eq('team', f.team);
  if (f.dateFrom) q = q.gte('created_at', f.dateFrom);
  if (f.dateTo)   q = q.lte('created_at', f.dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Called ONLY on Export click — fetches full dataset then hands it to
 * the export module which is also loaded lazily at that point.
 */
export async function fetchFullAuditsForExport(f: FilterParams) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('audits')
      .select('*')
      .order('audit_date', { ascending: false })
      .range(from, from + 999);
    if (f.team)     q = q.eq('team', f.team);
    if (f.dateFrom) q = q.gte('audit_date', f.dateFrom);
    if (f.dateTo)   q = q.lte('audit_date', f.dateTo);
    if (f.agentIds?.length) q = q.in('agent_id', f.agentIds);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}
