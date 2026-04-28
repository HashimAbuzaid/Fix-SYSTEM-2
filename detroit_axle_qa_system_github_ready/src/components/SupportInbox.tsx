import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  fetchSupportRequests,
  hasHelpSystemBackend,
  updateSupportRequestStatus,
  type SupportRequestRow,
  type SupportRequestStatus,
} from "../lib/helpSystemApi";
import type { UserProfile } from "../context/AuthContext";

interface SupportInboxProps {
  readonly currentUser: UserProfile;
}

const STATUSES: readonly SupportRequestStatus[] = ["new", "reviewing", "resolved", "closed"];

const cardStyle: CSSProperties = {
  borderRadius: "18px",
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  boxShadow: "var(--shadow-sm)",
};

const mutedTextStyle: CSSProperties = {
  color: "var(--fg-muted)",
  fontSize: "13px",
  lineHeight: 1.55,
};

function formatDate(value?: string): string {
  if (!value) return "Unknown date";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(value: SupportRequestStatus): string {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

const SupportInbox = memo(function SupportInbox({ currentUser }: SupportInboxProps) {
  const [requests, setRequests] = useState<readonly SupportRequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<SupportRequestStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canUseBackend = hasHelpSystemBackend();

  const loadRequests = useCallback(() => {
    if (!canUseBackend) {
      setLoading(false);
      setMessage("Supabase help-system tables are not configured yet. Run the included migration first.");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetchSupportRequests(controller.signal)
      .then((rows) => {
        setRequests(rows);
        setMessage("");
      })
      .catch((error: Error) => {
        setMessage(error.message || "Could not load support requests.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [canUseBackend]);

  useEffect(() => loadRequests(), [loadRequests]);

  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return requests.filter((request) => {
      const statusMatches = statusFilter === "all" || request.status === statusFilter;
      if (!statusMatches) return false;
      if (!normalizedQuery) return true;
      return [
        request.title,
        request.description,
        request.current_page,
        request.current_path,
        request.user_name,
        request.user_email,
        request.user_role,
        request.request_type,
        request.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, requests, statusFilter]);

  const counts = useMemo(() => {
    const initial: Record<SupportRequestStatus | "all", number> = {
      all: requests.length,
      new: 0,
      reviewing: 0,
      resolved: 0,
      closed: 0,
    };
    requests.forEach((request) => {
      initial[request.status] += 1;
    });
    return initial;
  }, [requests]);

  const changeStatus = async (id: string, status: SupportRequestStatus) => {
    try {
      const updated = await updateSupportRequestStatus(id, status);
      setRequests((current) => current.map((item) => (item.id === id ? updated : item)));
      setMessage("Support request updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update support request.");
    }
  };

  if (currentUser.role !== "admin") {
    return (
      <div style={{ ...cardStyle, padding: "28px", maxWidth: "720px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", letterSpacing: "-0.03em" }}>Support Inbox</h1>
        <p style={{ ...mutedTextStyle, marginTop: "10px" }}>
          This page is available to admins only.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-rose)", marginBottom: "6px" }}>
            Admin
          </div>
          <h1 style={{ margin: 0, fontSize: "28px", letterSpacing: "-0.04em", color: "var(--fg-default)" }}>
            Support Inbox
          </h1>
          <p style={{ ...mutedTextStyle, marginTop: "8px", maxWidth: "780px" }}>
            Review issues, feature requests, and admin-contact submissions from the Help Center. Each request captures page, role, browser, and workflow context.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadRequests()}
          style={{
            height: "38px",
            padding: "0 14px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--fg-default)",
            fontWeight: 700,
          }}
        >
          Refresh
        </button>
      </div>

      <section style={{ ...cardStyle, padding: "14px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        {(["all", ...STATUSES] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            style={{
              height: "34px",
              padding: "0 12px",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              background: statusFilter === status ? "color-mix(in srgb, var(--accent-blue) 14%, transparent)" : "var(--bg-subtle)",
              color: statusFilter === status ? "var(--fg-default)" : "var(--fg-muted)",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            {status === "all" ? "All" : statusLabel(status)} ({counts[status]})
          </button>
        ))}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search requests..."
          aria-label="Search support requests"
          style={{
            minWidth: "220px",
            flex: 1,
            height: "36px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--bg-subtle)",
            color: "var(--fg-default)",
            padding: "0 12px",
            outline: "none",
          }}
        />
      </section>

      {message && (
        <div role="status" style={{ ...cardStyle, padding: "12px 14px", color: "var(--fg-muted)", fontSize: "13px" }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ ...cardStyle, padding: "28px", ...mutedTextStyle }}>Loading support requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div style={{ ...cardStyle, padding: "28px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "var(--fg-default)" }}>No matching requests</h2>
          <p style={{ ...mutedTextStyle, marginTop: "8px" }}>
            Try a different status or search term.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {filteredRequests.map((request) => (
            <article key={request.id} style={{ ...cardStyle, padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-blue)" }}>
                      {request.request_type}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--fg-muted)" }}>{formatDate(request.created_at)}</span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: "17px", color: "var(--fg-default)", letterSpacing: "-0.02em" }}>
                    {request.title}
                  </h2>
                  <p style={{ ...mutedTextStyle, margin: "8px 0 0" }}>{request.description}</p>
                </div>
                <select
                  value={request.status}
                  onChange={(event) => changeStatus(request.id, event.target.value as SupportRequestStatus)}
                  aria-label={`Update status for ${request.title}`}
                  style={{
                    height: "34px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle)",
                    color: "var(--fg-default)",
                    padding: "0 10px",
                  }}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>{statusLabel(status)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginTop: "14px" }}>
                {[
                  ["Page", request.current_page || "—"],
                  ["Path", request.current_path || "—"],
                  ["User", request.user_name || request.user_email || "—"],
                  ["Role", request.user_role || "—"],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: "10px", borderRadius: "12px", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: "4px" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--fg-default)", wordBreak: "break-word" }}>{value}</div>
                  </div>
                ))}
              </div>

              {(request.expected_result || request.actual_result || request.steps_to_reproduce) && (
                <details style={{ marginTop: "12px" }}>
                  <summary style={{ cursor: "pointer", color: "var(--fg-default)", fontWeight: 700, fontSize: "13px" }}>
                    More details
                  </summary>
                  <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                    {request.expected_result && <pre style={preStyle}>Expected: {request.expected_result}</pre>}
                    {request.actual_result && <pre style={preStyle}>Actual: {request.actual_result}</pre>}
                    {request.steps_to_reproduce && <pre style={preStyle}>Steps: {request.steps_to_reproduce}</pre>}
                  </div>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
});

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--bg-subtle)",
  color: "var(--fg-muted)",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  lineHeight: 1.5,
};

export default SupportInbox;
