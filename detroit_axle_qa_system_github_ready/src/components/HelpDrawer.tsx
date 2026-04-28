import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  currentPage?: string;
  onNavigate?: (path: string) => void;
}

interface QuickAction {
  readonly label: string;
  readonly description: string;
  readonly path: string;
}

interface Guide {
  readonly title: string;
  readonly description: string;
}

interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

interface PageHelp {
  readonly title: string;
  readonly description: string;
  readonly tips: readonly string[];
}

interface ManagedHelpRow {
  readonly content_key: string;
  readonly content_type: "guide" | "faq" | "page" | "support";
  readonly title: string;
  readonly content: unknown;
  readonly sort_order?: number | null;
}

interface ManagedHelpContent {
  readonly guides: readonly Guide[];
  readonly faqs: readonly FaqItem[];
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    label: "New Audit",
    description: "Start a scored QA review.",
    path: "/new-audit",
  },
  {
    label: "Upload Audits",
    description: "Import completed audit data.",
    path: "/audits-upload",
  },
  {
    label: "View Reports",
    description: "Review trends, filters, and exports.",
    path: "/reports",
  },
  {
    label: "Open Dashboard",
    description: "Return to KPI cards and performance trends.",
    path: "/",
  },
];

const GUIDES: readonly Guide[] = [
  {
    title: "How scoring works",
    description:
      "Scores are calculated from selected metrics, outcomes, and audit criteria so teams can compare quality consistently.",
  },
  {
    title: "How to create an audit",
    description:
      "Choose the agent, team, audit type, and metric outcomes, then review the calculated score before saving.",
  },
  {
    title: "How reports are calculated",
    description:
      "Reports summarize audit records using the active filters, date ranges, teams, agents, channels, and score fields.",
  },
  {
    title: "How hidden/shared audits work",
    description:
      "Hidden audits can be excluded from shared views while remaining available for internal review and release control.",
  },
  {
    title: "How roles work",
    description:
      "Roles control which users can access admin tools, QA workflows, reports, supervisor views, and release actions.",
  },
];

const FAQS: readonly FaqItem[] = [
  {
    id: "hidden-audits",
    question: "Why can an audit be hidden?",
    answer:
      "An audit may be hidden when it should remain internal, needs review before release, or should not appear in shared reporting views yet.",
  },
  {
    id: "average-quality",
    question: "What does Average Quality mean?",
    answer:
      "Average Quality is the average audit score for the selected population, such as a date range, team, agent, or channel.",
  },
  {
    id: "target",
    question: "What does Target mean?",
    answer:
      "Target represents the quality benchmark used to compare actual performance against the expected QA standard.",
  },
  {
    id: "channels",
    question: "What is the difference between Calls, Tickets, and Sales?",
    answer:
      "Calls, Tickets, and Sales represent different audit channels. Each can use different evidence, workflows, and performance context.",
  },
  {
    id: "edit-delete",
    question: "Who can edit or delete audits?",
    answer:
      "Editing and deletion depend on the signed-in user's role and the audit state. Admin and QA permissions usually control these actions.",
  },
];

const PAGE_HELP: Record<string, PageHelp> = {
  dashboard: {
    title: "Dashboard",
    description:
      "Use the Dashboard to understand overall QA health at a glance.",
    tips: [
      "KPI cards summarize core performance indicators for the selected view.",
      "Trends help spot quality movement over time instead of relying on one audit.",
      "Recognition and trophy cabinet areas highlight wins and standout performance.",
    ],
  },
  auditsList: {
    title: "Audits List",
    description:
      "Use Audits List to review saved audits, visibility state, and release controls.",
    tips: [
      "Filters narrow audits by agent, team, channel, date range, score, or status.",
      "Hidden and shared states help control what appears in released views.",
      "Scores and release controls should be reviewed before sharing results broadly.",
    ],
  },
  newAudit: {
    title: "New Audit",
    description:
      "Use New Audit to create a structured QA review for an agent interaction.",
    tips: [
      "Select the correct agent and team before scoring.",
      "Choose the right metrics for the audit channel and interaction type.",
      "The score updates from selected metric outcomes before the audit is saved.",
    ],
  },
  reports: {
    title: "Reports",
    description:
      "Use Reports to analyze QA performance across teams, agents, channels, and time.",
    tips: [
      "Filters and multi-agent selections control which records are included.",
      "Exports should reflect the currently selected report criteria.",
      "Trend views help compare performance over time instead of one snapshot.",
    ],
  },
  monitoring: {
    title: "Monitoring",
    description:
      "Use Monitoring to track active quality alerts and coaching opportunities.",
    tips: [
      "Active alerts call attention to items that may need review.",
      "Coaching items help supervisors and QA staff prioritize follow-up.",
      "Review alert context before deciding whether action is needed.",
    ],
  },
  accounts: {
    title: "Accounts",
    description:
      "Use Accounts to manage users, permissions, roles, and account recovery support.",
    tips: [
      "Roles determine which parts of the QA system a user can access.",
      "User management changes should match the person's actual workflow.",
      "Password reset actions help users recover access without changing QA data.",
    ],
  },
  auditsUpload: {
    title: "Audits Upload",
    description:
      "Use Audits Upload to import completed audit records while keeping mappings and validation clear.",
    tips: [
      "Confirm the upload file format before importing.",
      "Review mapped columns, score fields, dates, agents, and teams before committing data.",
      "Use errors or skipped rows as a checklist for file cleanup.",
    ],
  },
  callsUpload: {
    title: "Calls Upload",
    description:
      "Use Calls Upload to bring call interaction evidence into the QA workflow.",
    tips: [
      "Check that call identifiers and agent fields line up with the source file.",
      "Use upload validation messages to catch missing or duplicated records.",
      "After upload, confirm records are visible where the team expects them.",
    ],
  },
  ticketsUpload: {
    title: "Tickets Upload",
    description:
      "Use Tickets Upload to import ticket records for ticket-based QA review and reporting.",
    tips: [
      "Validate ticket IDs, dates, agents, teams, and channel fields before saving.",
      "Keep ticket evidence aligned with the uploaded ticket record.",
      "Use reports after upload to verify the data lands in the expected filters.",
    ],
  },
  ticketEvidence: {
    title: "Ticket Evidence",
    description:
      "Use Ticket Evidence to attach or manage supporting details for ticket QA review.",
    tips: [
      "Match evidence to the correct ticket before relying on it for scoring.",
      "Keep notes factual and tied to the customer interaction.",
      "Review missing evidence before starting an audit that depends on it.",
    ],
  },
  ticketAiReview: {
    title: "Ticket AI Review",
    description:
      "Use Ticket AI Review to triage AI-assisted ticket review output before it influences QA decisions.",
    tips: [
      "Review AI findings as assistance, not as final QA judgment.",
      "Prioritize queues that show high-risk signals or missing evidence.",
      "Confirm any coaching action against the original ticket context.",
    ],
  },
  salesUpload: {
    title: "Sales Upload",
    description:
      "Use Sales Upload to import sales interaction records that support sales QA scoring and trend review.",
    tips: [
      "Validate sales identifiers, agent details, dates, and channel values.",
      "Check that uploaded rows connect to the right reporting period.",
      "Use reports to confirm imported sales records appear under the correct filters.",
    ],
  },
  agentFeedback: {
    title: "Agent Feedback",
    description:
      "Use Agent Feedback to review agent-facing QA notes, coaching context, and response status.",
    tips: [
      "Look for patterns across feedback instead of reacting to one isolated note.",
      "Use clear evidence-backed comments when feedback needs follow-up.",
      "Confirm intended visibility before sharing sensitive coaching context.",
    ],
  },
  teamHeatmap: {
    title: "Team Heatmap",
    description:
      "Use Team Heatmap to compare quality patterns across teams, agents, or metric areas.",
    tips: [
      "Look for clusters of repeated issues rather than one-off misses.",
      "Use filters to isolate the team or channel you are reviewing.",
      "Pair heatmap patterns with audit notes before making coaching decisions.",
    ],
  },
  supervisorRequests: {
    title: "Supervisor Requests",
    description:
      "Use Supervisor Requests to review supervisor-submitted requests, feedback, or release-related follow-up.",
    tips: [
      "Check the request context before approving, rejecting, or escalating.",
      "Use status filters to separate new requests from completed ones.",
      "Keep response notes direct and tied to the request details.",
    ],
  },
  supervisorOverview: {
    title: "Supervisor Overview",
    description:
      "Use Supervisor Overview to monitor team QA status, coaching priorities, and request activity.",
    tips: [
      "Start with the highest-level team indicators before drilling into detail.",
      "Use request and coaching context together to prioritize follow-up.",
      "Compare trends over time before drawing conclusions from one audit.",
    ],
  },
  supervisorTeamDashboard: {
    title: "Team Dashboard",
    description:
      "Use Team Dashboard to review team-level QA performance and identify coaching opportunities.",
    tips: [
      "Use team filters to focus on the agents you supervise.",
      "Look for recurring metric misses that need coaching or process review.",
      "Pair dashboard trends with audit notes before taking action.",
    ],
  },
  profile: {
    title: "Profile",
    description:
      "Use Profile to confirm account information, role, team, and agent identifiers.",
    tips: [
      "Your role controls which navigation items and actions are available.",
      "Check agent ID and team if reports or audits do not line up as expected.",
      "Contact an admin if account details need correction.",
    ],
  },
  default: {
    title: "General QA System Help",
    description:
      "The Detroit Axle QA System helps teams create audits, review performance, monitor coaching needs, and report quality trends.",
    tips: [
      "Use the sidebar to move between audit workflows, data uploads, analytics, and management tools.",
      "Use Search to quickly jump to a page.",
      "Use this Help Center for quick guidance without leaving your current page.",
    ],
  },
};

const SUPPORT_ACTIONS = [
  "Report an issue",
  "Request a feature",
  "Contact admin",
] as const;

function resolvePageHelp(currentPage?: string): PageHelp {
  const value = (currentPage ?? "").toLowerCase();

  if (value.includes("dashboard") || value === "/") return PAGE_HELP.dashboard;
  if (value.includes("audits list") || value.includes("/audits-list")) {
    return PAGE_HELP.auditsList;
  }
  if (value.includes("new audit") || value.includes("/new-audit")) {
    return PAGE_HELP.newAudit;
  }
  if (value.includes("reports") || value.includes("/reports")) {
    return PAGE_HELP.reports;
  }
  if (value.includes("monitoring") || value.includes("/monitoring")) {
    return PAGE_HELP.monitoring;
  }
  if (value.includes("accounts") || value.includes("/accounts")) {
    return PAGE_HELP.accounts;
  }


  if (value.includes("audits upload") || value.includes("/audits-upload")) {
    return PAGE_HELP.auditsUpload;
  }
  if (value.includes("calls upload") || value.includes("/calls-upload")) {
    return PAGE_HELP.callsUpload;
  }
  if (value.includes("tickets upload") || value.includes("/tickets-upload")) {
    return PAGE_HELP.ticketsUpload;
  }
  if (value.includes("ticket evidence") || value.includes("/ticket-evidence")) {
    return PAGE_HELP.ticketEvidence;
  }
  if (value.includes("ticket ai review") || value.includes("/ticket-ai-review")) {
    return PAGE_HELP.ticketAiReview;
  }
  if (value.includes("sales upload") || value.includes("/sales-upload")) {
    return PAGE_HELP.salesUpload;
  }
  if (value.includes("agent feedback") || value.includes("/agent-feedback")) {
    return PAGE_HELP.agentFeedback;
  }
  if (value.includes("team heatmap") || value.includes("/team-heatmap")) {
    return PAGE_HELP.teamHeatmap;
  }
  if (
    value.includes("supervisor requests") ||
    value.includes("/supervisor-requests") ||
    value.includes("/supervisor/requests")
  ) {
    return PAGE_HELP.supervisorRequests;
  }
  if (value.includes("team dashboard") || value.includes("/supervisor/team-dashboard")) {
    return PAGE_HELP.supervisorTeamDashboard;
  }
  if (value.includes("overview") || value.includes("/supervisor")) {
    return PAGE_HELP.supervisorOverview;
  }
  if (value.includes("profile") || value.includes("/profile")) {
    return PAGE_HELP.profile;
  }

  return PAGE_HELP.default;
}

function includesQuery(query: string, parts: readonly string[]): boolean {
  if (!query) return true;
  return parts.join(" ").toLowerCase().includes(query);
}

const overlayStyleBase: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 160,
};

const closeButtonStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-subtle)",
  color: "var(--fg-muted)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const sectionStyle: CSSProperties = {
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid var(--border)",
  background: "var(--bg-subtle)",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 700,
  color: "var(--fg-default)",
  letterSpacing: "-0.01em",
};

const sectionSubtitleStyle: CSSProperties = {
  marginTop: "4px",
  fontSize: "12px",
  lineHeight: 1.55,
  color: "var(--fg-muted)",
};

const smallLabelStyle: CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--accent-blue)",
  marginBottom: "8px",
};


function buildSupportDraft(label: string, currentPage?: string): string {
  const path = typeof window === "undefined" ? "Unknown path" : window.location.pathname;
  const timestamp = new Date().toISOString();
  const browser = typeof window === "undefined" ? "Unknown browser" : window.navigator.userAgent;
  const type = label.toLowerCase().includes("feature")
    ? "Feature request"
    : label.toLowerCase().includes("admin")
      ? "Admin contact"
      : "Issue report";

  const prompt = type === "Feature request"
    ? "Feature idea:\n\nWho needs it?\n\nWhat problem would it solve?\n\nSuggested workflow:\n1. \n2. \n3. "
    : type === "Admin contact"
      ? "Question for admin:\n\nWhat access, account, report, audit, or workflow needs attention?\n"
      : "What happened?\n\nExpected result:\n\nActual result:\n\nSteps to reproduce:\n1. \n2. \n3. ";

  return [
    "Detroit Axle QA System Support Request",
    `Type: ${type}`,
    `Current page: ${currentPage || "Unknown page"}`,
    `Current path: ${path}`,
    `Timestamp: ${timestamp}`,
    `Browser: ${browser}`,
    "",
    prompt,
  ].join("\n");
}

async function copySupportDraft(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

function openSupportEmail(body: string) {
  window.location.href = `mailto:?subject=${encodeURIComponent("Detroit Axle QA System support request")}&body=${encodeURIComponent(body)}`;
}

function getHelpContentEnv() {
  const env = (import.meta as ImportMeta & {
    readonly env?: Record<string, string | undefined>;
  }).env;

  return {
    supabaseUrl: env?.VITE_SUPABASE_URL,
    supabaseAnonKey: env?.VITE_SUPABASE_ANON_KEY,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readContentString(content: unknown, keys: readonly string[]): string {
  if (!isRecord(content)) return "";
  for (const key of keys) {
    const value = content[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function normalizeManagedHelpRows(rows: readonly ManagedHelpRow[]): ManagedHelpContent {
  const guides: Guide[] = [];
  const faqs: FaqItem[] = [];

  rows.forEach((row) => {
    if (row.content_type === "guide") {
      guides.push({
        title: row.title,
        description: readContentString(row.content, ["description", "body"]),
      });
    }

    if (row.content_type === "faq") {
      faqs.push({
        id: row.content_key,
        question: row.title,
        answer: readContentString(row.content, ["answer", "body"]),
      });
    }
  });

  return { guides, faqs };
}

async function fetchManagedHelpContent(signal: AbortSignal): Promise<ManagedHelpContent | null> {
  const { supabaseUrl, supabaseAnonKey } = getHelpContentEnv();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const response = await fetch(
    `${baseUrl}/rest/v1/qa_help_content?active=eq.true&content_type=in.(guide,faq)&select=content_key,content_type,title,content,sort_order&order=sort_order.asc`,
    {
      signal,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    }
  );

  if (!response.ok) return null;
  const rows = (await response.json()) as ManagedHelpRow[];
  return normalizeManagedHelpRows(rows);
}

function mergeGuides(managedGuides: readonly Guide[]): readonly Guide[] {
  const byTitle = new Map<string, Guide>();
  GUIDES.forEach((guide) => byTitle.set(guide.title, guide));
  managedGuides.forEach((guide) => byTitle.set(guide.title, guide));
  return Array.from(byTitle.values());
}

function mergeFaqs(managedFaqs: readonly FaqItem[]): readonly FaqItem[] {
  const byQuestion = new Map<string, FaqItem>();
  FAQS.forEach((faq) => byQuestion.set(faq.question, faq));
  managedFaqs.forEach((faq) => byQuestion.set(faq.question, faq));
  return Array.from(byQuestion.values());
}

function HelpDrawer({
  open,
  onClose,
  currentPage,
  onNavigate,
}: HelpDrawerProps) {
  const [query, setQuery] = useState("");
  const [openFaqId, setOpenFaqId] = useState<string>("hidden-audits");
  const [supportMessage, setSupportMessage] = useState("");
  const [managedHelp, setManagedHelp] = useState<ManagedHelpContent | null>(null);
  const [managedHelpLoaded, setManagedHelpLoaded] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const pageHelp = useMemo(() => resolvePageHelp(currentPage), [currentPage]);
  const allGuides = useMemo(
    () => mergeGuides(managedHelp?.guides ?? []),
    [managedHelp]
  );
  const allFaqs = useMemo(
    () => mergeFaqs(managedHelp?.faqs ?? []),
    [managedHelp]
  );

  useEffect(() => {
    if (!open || managedHelpLoaded) return;

    const controller = new AbortController();

    fetchManagedHelpContent(controller.signal)
      .then((content) => {
        if (content) setManagedHelp(content);
      })
      .catch(() => undefined)
      .finally(() => setManagedHelpLoaded(true));

    return () => controller.abort();
  }, [managedHelpLoaded, open]);

  const filteredQuickActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) =>
        includesQuery(normalizedQuery, [
          action.label,
          action.description,
          action.path,
          "quick actions",
        ])
      ),
    [normalizedQuery]
  );

  const filteredGuides = useMemo(
    () =>
      allGuides.filter((guide) =>
        includesQuery(normalizedQuery, [
          guide.title,
          guide.description,
          "guides",
        ])
      ),
    [allGuides, normalizedQuery]
  );

  const filteredFaqs = useMemo(
    () =>
      allFaqs.filter((faq) =>
        includesQuery(normalizedQuery, [
          faq.question,
          faq.answer,
          "faq",
        ])
      ),
    [allFaqs, normalizedQuery]
  );

  const filteredSupportActions = useMemo(
    () =>
      SUPPORT_ACTIONS.filter((label) =>
        includesQuery(normalizedQuery, [label, "support"])
      ),
    [normalizedQuery]
  );

  const showPageHelp = includesQuery(normalizedQuery, [
    pageHelp.title,
    pageHelp.description,
    ...pageHelp.tips,
    "this page",
    "current page",
  ]);

  const hasResults =
    filteredQuickActions.length > 0 ||
    showPageHelp ||
    filteredGuides.length > 0 ||
    filteredFaqs.length > 0 ||
    filteredSupportActions.length > 0;

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handler);
    closeButtonRef.current?.focus();

    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);


  useEffect(() => {
    if (!open) {
      setSupportMessage("");
    }
  }, [open]);

  const handleNavigate = (path: string) => {
    if (!onNavigate) return;
    onNavigate(path);
    onClose();
  };


  const handleSupportAction = async (label: string) => {
    const draft = buildSupportDraft(label, currentPage);
    const copied = await copySupportDraft(draft);

    if (label === "Contact admin") {
      openSupportEmail(draft);
      setSupportMessage(
        copied
          ? "Email draft opened and details copied. Add the admin recipient before sending."
          : "Email draft opened. Add the admin recipient before sending."
      );
      return;
    }

    setSupportMessage(
      copied
        ? "Draft copied. Paste it into your support channel, email, or ticket system."
        : "Clipboard access was blocked. Use Contact admin to open an email draft instead."
    );
  };

  return (
    <div
      aria-hidden={!open}
      style={{
        ...overlayStyleBase,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "color-mix(in srgb, var(--bg-base) 34%, rgba(0, 0, 0, 0.54))",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          opacity: open ? 1 : 0,
          transition: "opacity 180ms var(--ease-out)",
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
        aria-describedby="help-drawer-subtitle"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "min(468px, 100vw)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderLeft: "1px solid var(--border-strong)",
          borderTopLeftRadius: "20px",
          borderBottomLeftRadius: "20px",
          background:
            "linear-gradient(180deg, var(--bg-elevated), var(--bg-overlay))",
          boxShadow: "var(--shadow-lg)",
          opacity: open ? 1 : 0.98,
          transform: open ? "translateX(0)" : "translateX(104%)",
          transition:
            "transform 260ms var(--ease-out), opacity 180ms ease",
          willChange: "transform",
        }}
      >
        <header
          style={{
            padding: "20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--header-bg)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <div>
              <div style={smallLabelStyle}>Help</div>
              <h2
                id="help-drawer-title"
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "var(--fg-default)",
                  letterSpacing: "-0.03em",
                }}
              >
                Help Center
              </h2>
              <p
                id="help-drawer-subtitle"
                style={{
                  margin: "5px 0 0",
                  fontSize: "13px",
                  color: "var(--fg-muted)",
                }}
              >
                Detroit Axle QA System
              </p>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close Help Center"
              title="Close"
              style={closeButtonStyle}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              height: "40px",
              marginTop: "18px",
              padding: "0 12px",
              borderRadius: "12px",
              border: "1px solid var(--border-strong)",
              background: "var(--bg-elevated)",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--fg-muted)", flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help, guides, or actions…"
              aria-label="Search help, guides, or actions"
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                outline: "none",
                background: "transparent",
                color: "var(--fg-default)",
                font: "inherit",
                fontSize: "13px",
              }}
            />
          </div>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {!hasResults && (
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>No help results</h3>
              <p style={sectionSubtitleStyle}>
                Try searching for scoring, reports, audits, roles, or support.
              </p>
            </section>
          )}

          {filteredQuickActions.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-quick-actions">
              <div style={smallLabelStyle}>Quick Actions</div>
              <h3 id="help-quick-actions" style={sectionTitleStyle}>
                Jump to common tasks
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "10px",
                  marginTop: "12px",
                }}
              >
                {filteredQuickActions.map((action) => {
                  const disabled = !onNavigate;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleNavigate(action.path)}
                      style={{
                        minHeight: "82px",
                        padding: "12px",
                        borderRadius: "13px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                        color: disabled ? "var(--fg-subtle)" : "var(--fg-default)",
                        textAlign: "left",
                        cursor: disabled ? "default" : "pointer",
                        opacity: disabled ? 0.68 : 1,
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: 700,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {action.label}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: "5px",
                          fontSize: "11px",
                          lineHeight: 1.45,
                          color: "var(--fg-muted)",
                        }}
                      >
                        {action.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {showPageHelp && (
            <section style={sectionStyle} aria-labelledby="help-this-page">
              <div style={smallLabelStyle}>This Page</div>
              <h3 id="help-this-page" style={sectionTitleStyle}>
                {pageHelp.title}
              </h3>
              <p style={sectionSubtitleStyle}>{pageHelp.description}</p>
              <ul
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  margin: "12px 0 0",
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {pageHelp.tips.map((tip) => (
                  <li
                    key={tip}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      fontSize: "12px",
                      lineHeight: 1.55,
                      color: "var(--fg-muted)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: "6px",
                        height: "6px",
                        marginTop: "7px",
                        borderRadius: "999px",
                        background: "var(--accent-blue)",
                        flexShrink: 0,
                      }}
                    />
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {filteredGuides.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-guides">
              <div style={smallLabelStyle}>Guides</div>
              <h3 id="help-guides" style={sectionTitleStyle}>
                Learn the workflow
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "9px",
                  marginTop: "12px",
                }}
              >
                {filteredGuides.map((guide) => (
                  <article
                    key={guide.title}
                    style={{
                      padding: "12px",
                      borderRadius: "13px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "var(--fg-default)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {guide.title}
                    </h4>
                    <p
                      style={{
                        margin: "5px 0 0",
                        fontSize: "12px",
                        lineHeight: 1.55,
                        color: "var(--fg-muted)",
                      }}
                    >
                      {guide.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {filteredFaqs.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-faq">
              <div style={smallLabelStyle}>FAQ</div>
              <h3 id="help-faq" style={sectionTitleStyle}>
                Common questions
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginTop: "12px",
                }}
              >
                {filteredFaqs.map((faq) => {
                  const expanded = openFaqId === faq.id || Boolean(normalizedQuery);
                  const panelId = `help-faq-${faq.id}`;
                  return (
                    <div
                      key={faq.id}
                      style={{
                        borderRadius: "13px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                        overflow: "hidden",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaqId((current) =>
                            current === faq.id ? "" : faq.id
                          )
                        }
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "12px",
                          border: 0,
                          background: "transparent",
                          color: "var(--fg-default)",
                          textAlign: "left",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        {faq.question}
                        <span
                          aria-hidden="true"
                          style={{
                            color: "var(--fg-muted)",
                            transform: expanded
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            transition: "transform 160ms var(--ease-out)",
                          }}
                        >
                          ▾
                        </span>
                      </button>
                      {expanded && (
                        <div
                          id={panelId}
                          style={{
                            padding: "0 12px 12px",
                            fontSize: "12px",
                            lineHeight: 1.55,
                            color: "var(--fg-muted)",
                          }}
                        >
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {filteredSupportActions.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-support">
              <div style={smallLabelStyle}>Support</div>
              <h3 id="help-support" style={sectionTitleStyle}>
                Need more help?
              </h3>
              <p style={sectionSubtitleStyle}>
                Use these actions to capture page context, browser details, and a clean request template.
              </p>
              {supportMessage && (
                <div
                  role="status"
                  style={{
                    marginTop: "10px",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent)",
                    background: "color-mix(in srgb, var(--accent-emerald) 10%, transparent)",
                    color: "var(--fg-default)",
                    fontSize: "12px",
                    lineHeight: 1.45,
                  }}
                >
                  {supportMessage}
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "9px",
                  marginTop: "12px",
                }}
              >
                {filteredSupportActions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSupportAction(label)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      minHeight: "42px",
                      padding: "0 12px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--fg-default)",
                      fontSize: "13px",
                      fontWeight: 650,
                    }}
                  >
                    {label}
                    <span aria-hidden="true" style={{ color: "var(--fg-muted)" }}>
                      →
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

export default HelpDrawer;
