import type { AuditFilters, AuditItem } from '../QA/useAudits';

export type AuditsPage = {
  data: AuditItem[];
  nextPage: number | null;
};

type AuditsApiResponse = {
  data: AuditItem[];
  next_page: number | null;
};

const usePythonAuditsApi = String(import.meta.env.VITE_USE_PY_AUDITS_API || '').toLowerCase() === 'true';
const pythonAuditsApiBaseUrl = String(import.meta.env.VITE_PY_AUDITS_API_BASE_URL || '').trim();

export function isPythonAuditsApiEnabled(): boolean {
  return usePythonAuditsApi && !!pythonAuditsApiBaseUrl;
}

export async function fetchAuditsPageFromPythonApi(
  filters: AuditFilters,
  pageParam: number,
  pageSize: number,
): Promise<AuditsPage> {
  if (!pythonAuditsApiBaseUrl) {
    throw new Error('VITE_PY_AUDITS_API_BASE_URL is missing while Python audits API is enabled.');
  }

  const params = new URLSearchParams({
    page: String(pageParam),
    page_size: String(pageSize),
  });

  if (filters.teamFilter) params.set('team', filters.teamFilter);
  if (filters.caseTypeFilter) params.set('case_type', filters.caseTypeFilter);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);

  const response = await fetch(`${pythonAuditsApiBaseUrl}/api/audits?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Python audits API request failed (${response.status})`);
  }

  const payload = (await response.json()) as AuditsApiResponse;
  return {
    data: payload.data ?? [],
    nextPage: payload.next_page ?? null,
  };
}

