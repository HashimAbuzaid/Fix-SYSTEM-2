export type HelpContentType = "guide" | "faq" | "page" | "support" | "release_note" | "tour";

export type SupportRequestType = "issue" | "feature" | "admin";
export type SupportRequestStatus = "new" | "reviewing" | "resolved" | "closed";

export interface HelpUserContext {
  readonly name?: string;
  readonly email?: string;
  readonly role?: string;
}

export interface HelpContentRow {
  readonly id?: string;
  readonly content_key: string;
  readonly content_type: HelpContentType;
  readonly title: string;
  readonly content: unknown;
  readonly roles?: readonly string[] | null;
  readonly sort_order?: number | null;
  readonly active?: boolean | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface SupportRequestPayload {
  readonly request_type: SupportRequestType;
  readonly title: string;
  readonly description: string;
  readonly expected_result?: string;
  readonly actual_result?: string;
  readonly steps_to_reproduce?: string;
  readonly current_page?: string;
  readonly current_path?: string;
  readonly user_name?: string;
  readonly user_email?: string;
  readonly user_role?: string;
  readonly browser?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface SupportRequestRow extends SupportRequestPayload {
  readonly id: string;
  readonly status: SupportRequestStatus;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface HelpAnalyticsEventPayload {
  readonly event_name: string;
  readonly current_page?: string;
  readonly current_path?: string;
  readonly user_role?: string;
  readonly query?: string;
  readonly target?: string;
  readonly metadata?: Record<string, unknown>;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function getHelpSystemEnv() {
  const env = (import.meta as ImportMeta & {
    readonly env?: Record<string, string | undefined>;
  }).env;

  return {
    supabaseUrl: env?.VITE_SUPABASE_URL,
    supabaseAnonKey: env?.VITE_SUPABASE_ANON_KEY,
  };
}

export function hasHelpSystemBackend(): boolean {
  const { supabaseUrl, supabaseAnonKey } = getHelpSystemEnv();
  return Boolean(supabaseUrl && supabaseAnonKey);
}

function getBrowserUserAgent(): string {
  if (typeof window === "undefined") return "Unknown browser";
  return window.navigator.userAgent;
}

export function getCurrentHelpPath(): string {
  if (typeof window === "undefined") return "Unknown path";
  return window.location.pathname;
}

export function buildSupportMetadata(): Record<string, unknown> {
  return {
    browser: getBrowserUserAgent(),
    language:
      typeof window === "undefined" ? "unknown" : window.navigator.language,
    viewport:
      typeof window === "undefined"
        ? "unknown"
        : `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
  };
}

async function supabaseRest<T>(
  path: string,
  method: HttpMethod,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const { supabaseUrl, supabaseAnonKey } = getHelpSystemEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    signal,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchActiveHelpContent(
  signal?: AbortSignal
): Promise<readonly HelpContentRow[]> {
  return supabaseRest<HelpContentRow[]>(
    "qa_help_content?active=eq.true&select=*&order=sort_order.asc,title.asc",
    "GET",
    undefined,
    signal
  );
}

export async function fetchAllHelpContent(
  signal?: AbortSignal
): Promise<readonly HelpContentRow[]> {
  return supabaseRest<HelpContentRow[]>(
    "qa_help_content?select=*&order=content_type.asc,sort_order.asc,title.asc",
    "GET",
    undefined,
    signal
  );
}

export async function createHelpContent(
  row: Omit<HelpContentRow, "id" | "created_at" | "updated_at">
): Promise<HelpContentRow> {
  const created = await supabaseRest<HelpContentRow[]>("qa_help_content", "POST", row);
  return created[0];
}

export async function updateHelpContent(
  id: string,
  row: Partial<Omit<HelpContentRow, "id" | "created_at" | "updated_at">>
): Promise<HelpContentRow> {
  const updated = await supabaseRest<HelpContentRow[]>(
    `qa_help_content?id=eq.${encodeURIComponent(id)}`,
    "PATCH",
    row
  );
  return updated[0];
}

export async function deleteHelpContent(id: string): Promise<void> {
  await supabaseRest<void>(
    `qa_help_content?id=eq.${encodeURIComponent(id)}`,
    "DELETE"
  );
}

export async function createSupportRequest(
  payload: SupportRequestPayload
): Promise<SupportRequestRow> {
  const created = await supabaseRest<SupportRequestRow[]>("qa_support_requests", "POST", {
    ...payload,
    status: "new",
    browser: payload.browser || getBrowserUserAgent(),
    metadata: {
      ...buildSupportMetadata(),
      ...(payload.metadata || {}),
    },
  });
  return created[0];
}

export async function fetchSupportRequests(
  signal?: AbortSignal
): Promise<readonly SupportRequestRow[]> {
  return supabaseRest<SupportRequestRow[]>(
    "qa_support_requests?select=*&order=created_at.desc",
    "GET",
    undefined,
    signal
  );
}

export async function updateSupportRequestStatus(
  id: string,
  status: SupportRequestStatus
): Promise<SupportRequestRow> {
  const updated = await supabaseRest<SupportRequestRow[]>(
    `qa_support_requests?id=eq.${encodeURIComponent(id)}`,
    "PATCH",
    { status }
  );
  return updated[0];
}

export async function recordHelpEvent(payload: HelpAnalyticsEventPayload): Promise<void> {
  if (!hasHelpSystemBackend()) return;

  try {
    await supabaseRest<void>("qa_help_events", "POST", {
      ...payload,
      current_path: payload.current_path || getCurrentHelpPath(),
      metadata: {
        ...buildSupportMetadata(),
        ...(payload.metadata || {}),
      },
    });
  } catch {
    // Analytics must never interrupt the user workflow.
  }
}
