/**
 * useAudits.ts
 *
 * Custom TanStack Query hooks for AuditsListSupabase.
 *
 * Design decisions:
 *  - useAuditsInfinite  → infinite-scroll paginated audits (PAGE_SIZE rows/page)
 *  - useProfiles        → small table, fetched once, stale after 5 min
 *  - useCurrentProfile  → current user's profile row, stale after 5 min
 *  - useAgentDailyStatus → today's OFF/eval-off rows, refetches every 60 s
 *
 * All queries are keyed so that filters trigger a fresh fetch automatically.
 * No manual useEffect loading, no viewCache dependency.
 */

import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/* ─── Constants ─────────────────────────────────────────── */

export const PAGE_SIZE = 50;

/* ─── Types (re-exported so the component can import from one place) ─── */

export type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjustedWeight: number;
  earned: number;
  counts_toward_score?: boolean;
  metric_comment?: string | null;
};

export type AuditItem = {
  id: string;
  created_at?: string | null;
  agent_id: string;
  agent_name: string;
  team: 'Calls' | 'Tickets' | 'Sales';
  case_type: string;
  audit_date: string;
  order_number?: string | null;
  phone_number?: string | null;
  ticket_id?: string | null;
  quality_score: number;
  comments: string | null;
  score_details: ScoreDetail[];
  shared_with_agent?: boolean;
  shared_at?: string | null;
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
  created_by_role?: string | null;
};

export type AgentProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent';
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: 'Calls' | 'Tickets' | 'Sales' | null;
};

export type CurrentProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent' | null;
  agent_name?: string | null;
};

export type AgentDailyStatus = {
  agent_id: string;
  team: 'Calls' | 'Tickets' | 'Sales';
  status_date: string;
  status: string;
};

/* ─── Filter shape passed to useAuditsInfinite ───────────── */

export type AuditFilters = {
  teamFilter: string;
  caseTypeFilter: string;
  dateFrom: string;
  dateTo: string;
  /** Raw search text — filtering is done client-side after fetch */
};

/* ─── Query key factories ────────────────────────────────── */

export const auditKeys = {
  all: ['audits'] as const,
  infinite: (filters: AuditFilters) => [...auditKeys.all, 'infinite', filters] as const,
  profiles: () => ['profiles', 'agents'] as const,
  currentProfile: (uid: string | undefined) => ['profiles', 'current', uid ?? 'anon'] as const,
  dailyStatus: (date: string) => ['agentDailyStatus', date] as const,
};

/* ════════════════════════════════════════════════════════════
   useAuditsInfinite
   ════════════════════════════════════════════════════════════

   Returns pages of PAGE_SIZE audits.
   Supabase range is 0-based: page 0 → rows 0–49, page 1 → rows 50–99, …

   The query key includes all server-side filters so changing a filter
   discards the cache and starts from page 0 automatically.

   NOTE: Text search (agent name / display name / agent id) is intentionally
   left client-side because it needs the joined display_name from profiles.
   All other filters are pushed to Supabase.
*/

async function fetchAuditsPage(
  filters: AuditFilters,
  pageParam: number,
): Promise<{ data: AuditItem[]; nextPage: number | null }> {
  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('audits')
    .select('*')
    .order('created_at', { ascending: false })
    .order('audit_date', { ascending: false })
    .range(from, to);

  if (filters.teamFilter)     query = query.eq('team', filters.teamFilter);
  if (filters.caseTypeFilter) query = query.eq('case_type', filters.caseTypeFilter);
  if (filters.dateFrom)       query = query.gte('audit_date', filters.dateFrom);
  if (filters.dateTo)         query = query.lte('audit_date', filters.dateTo);

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  const rows = (data as AuditItem[]) ?? [];

  // If we got a full page there may be more; otherwise we've reached the end.
  return {
    data: rows,
    nextPage: rows.length === PAGE_SIZE ? pageParam + 1 : null,
  };
}

export function useAuditsInfinite(
  filters: AuditFilters,
): UseInfiniteQueryResult<InfiniteData<{ data: AuditItem[]; nextPage: number | null }>> {
  return useInfiniteQuery({
    queryKey: auditKeys.infinite(filters),
    queryFn: ({ pageParam }) => fetchAuditsPage(filters, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    staleTime: 30_000,   // consider data fresh for 30 s — avoids re-fetch on tab focus
    gcTime: 5 * 60_000,  // keep pages in memory for 5 min after unmount
  });
}

/** Convenience selector: flatten all pages into a single array */
export function flattenAuditPages(
  data: InfiniteData<{ data: AuditItem[]; nextPage: number | null }> | undefined,
): AuditItem[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.data);
}

/* ════════════════════════════════════════════════════════════
   useProfiles
   ════════════════════════════════════════════════════════════ */

async function fetchAgentProfiles(): Promise<AgentProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, agent_id, agent_name, display_name, team')
    .eq('role', 'agent')
    .order('agent_name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as AgentProfile[]) ?? [];
}

export function useProfiles(): UseQueryResult<AgentProfile[]> {
  return useQuery({
    queryKey: auditKeys.profiles(),
    queryFn: fetchAgentProfiles,
    staleTime: 5 * 60_000,
  });
}

/* ════════════════════════════════════════════════════════════
   useCurrentProfile
   ════════════════════════════════════════════════════════════ */

async function fetchCurrentProfile(uid: string): Promise<CurrentProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, agent_name')
    .eq('id', uid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as CurrentProfile) ?? null;
}

export function useCurrentProfile(): UseQueryResult<CurrentProfile | null> {
  // First resolve the auth user, then conditionally fetch profile
  const authQuery = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw new Error(error.message);
      return data.user?.id ?? null;
    },
    staleTime: 5 * 60_000,
  });

  return useQuery({
    queryKey: auditKeys.currentProfile(authQuery.data ?? undefined),
    queryFn: () => fetchCurrentProfile(authQuery.data!),
    enabled: !!authQuery.data,
    staleTime: 5 * 60_000,
  });
}

/* ════════════════════════════════════════════════════════════
   useAgentDailyStatus
   ════════════════════════════════════════════════════════════ */

async function fetchAgentDailyStatus(date: string): Promise<AgentDailyStatus[]> {
  const { data, error } = await supabase
    .from('agent_daily_status')
    .select('agent_id, team, status_date, status')
    .eq('status_date', date);

  if (error) throw new Error(error.message);
  return (data as AgentDailyStatus[]) ?? [];
}

export function useAgentDailyStatus(date: string): UseQueryResult<AgentDailyStatus[]> {
  return useQuery({
    queryKey: auditKeys.dailyStatus(date),
    queryFn: () => fetchAgentDailyStatus(date),
    staleTime: 60_000,        // refresh every 60 s via refetchInterval
    refetchInterval: 60_000,  // replaces the Supabase realtime channel
  });
}
