import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  createSupportRequest,
  fetchActiveHelpContent,
  getCurrentHelpPath,
  hasHelpSystemBackend,
  recordHelpEvent,
  type HelpContentRow,
  type SupportRequestType,
} from "../lib/helpSystemApi";

export interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  currentPage?: string;
  currentRole?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  onNavigate?: (path: string) => void;
  onStartTour?: (tourId: string) => void;
}

type HelpRole = "all" | "admin" | "qa" | "supervisor" | "agent" | string;

interface QuickAction {
  readonly label: string;
  readonly description: string;
  readonly path: string;
  readonly roles: readonly HelpRole[];
  readonly aliases: readonly string[];
}

interface Guide {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly roles: readonly HelpRole[];
  readonly aliases: readonly string[];
}

interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly roles: readonly HelpRole[];
  readonly aliases: readonly string[];
}

interface PageHelp {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly tips: readonly string[];
  readonly aliases: readonly string[];
}

interface ReleaseNote {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly roles: readonly HelpRole[];
}

interface TourItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly roles: readonly HelpRole[];
  readonly aliases: readonly string[];
}

interface ManagedHelpContent {
  readonly guides: readonly Guide[];
  readonly faqs: readonly FaqItem[];
  readonly releaseNotes: readonly ReleaseNote[];
  readonly pages: Record<string, PageHelp>;
  readonly tours: readonly TourItem[];
}

interface SupportFormState {
  readonly title: string;
  readonly description: string;
  readonly expected: string;
  readonly actual: string;
  readonly steps: string;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    label: "New Audit",
    description: "Start a scored QA review.",
    path: "/new-audit",
    roles: ["admin", "qa"],
    aliases: ["create audit", "score call", "score ticket", "quality review"],
  },
  {
    label: "Upload Audits",
    description: "Import completed audit data.",
    path: "/audits-upload",
    roles: ["admin", "qa"],
    aliases: ["import audits", "bulk upload", "csv"],
  },
  {
    label: "View Reports",
    description: "Review trends, filters, and exports.",
    path: "/reports",
    roles: ["admin", "qa"],
    aliases: ["analytics", "export", "average quality", "target"],
  },
  {
    label: "Open Dashboard",
    description: "Return to KPI cards and performance trends.",
    path: "/",
    roles: ["admin", "qa"],
    aliases: ["kpi", "home", "overview"],
  },
  {
    label: "Team Dashboard",
    description: "Review team-level quality and coaching signals.",
    path: "/supervisor/team-dashboard",
    roles: ["supervisor"],
    aliases: ["team", "coaching", "supervisor"],
  },
  {
    label: "Support Inbox",
    description: "Review submitted issues and feature requests.",
    path: "/support-inbox",
    roles: ["admin"],
    aliases: ["tickets", "issues", "requests"],
  },
  {
    label: "Help Admin",
    description: "Edit guides, FAQs, page help, and release notes.",
    path: "/help-admin",
    roles: ["admin"],
    aliases: ["cms", "content", "faq editor"],
  },
];

const GUIDES: readonly Guide[] = [
  {
    key: "how-scoring-works",
    title: "How scoring works",
    description:
      "Scores are calculated from selected metrics, outcomes, and audit criteria so teams can compare quality consistently.",
    roles: ["all"],
    aliases: ["score", "quality score", "average quality", "metric", "target"],
  },
  {
    key: "how-to-create-audit",
    title: "How to create an audit",
    description:
      "Choose the agent, team, audit type, and metric outcomes, then review the calculated score before saving.",
    roles: ["admin", "qa"],
    aliases: ["new audit", "audit workflow", "agent", "team"],
  },
  {
    key: "how-reports-are-calculated",
    title: "How reports are calculated",
    description:
      "Reports summarize audit records using the active filters, date ranges, teams, agents, channels, and score fields.",
    roles: ["admin", "qa", "supervisor"],
    aliases: ["reports", "filters", "exports", "trend", "multi-agent"],
  },
  {
    key: "hidden-shared-audits",
    title: "How hidden/shared audits work",
    description:
      "Hidden audits can be excluded from shared views while remaining available for internal review and release control.",
    roles: ["admin", "qa", "supervisor"],
    aliases: ["hidden", "shared", "release", "visibility"],
  },
  {
    key: "how-roles-work",
    title: "How roles work",
    description:
      "Roles control which users can access admin tools, QA workflows, reports, supervisor views, and release actions.",
    roles: ["all"],
    aliases: ["permission", "admin", "qa", "supervisor", "agent"],
  },
  {
    key: "agent-feedback-guide",
    title: "How agent feedback works",
    description:
      "Agent feedback should connect audit evidence, coaching context, and response status without exposing unnecessary internal notes.",
    roles: ["admin", "qa", "supervisor", "agent"],
    aliases: ["feedback", "coaching", "agent portal"],
  },
];

const FAQS: readonly FaqItem[] = [
  {
    id: "hidden-audits",
    question: "Why can an audit be hidden?",
    answer:
      "An audit may be hidden when it should remain internal, needs review before release, or should not appear in shared reporting views yet.",
    roles: ["admin", "qa", "supervisor"],
    aliases: ["hidden", "release", "shared"],
  },
  {
    id: "average-quality",
    question: "What does Average Quality mean?",
    answer:
      "Average Quality is the average audit score for the selected population, such as a date range, team, agent, or channel.",
    roles: ["all"],
    aliases: ["avg quality", "score", "quality"],
  },
  {
    id: "target",
    question: "What does Target mean?",
    answer:
      "Target represents the quality benchmark used to compare actual performance against the expected QA standard.",
    roles: ["all"],
    aliases: ["goal", "benchmark", "threshold"],
  },
  {
    id: "channels",
    question: "What is the difference between Calls, Tickets, and Sales?",
    answer:
      "Calls, Tickets, and Sales represent different audit channels. Each can use different evidence, workflows, and performance context.",
    roles: ["all"],
    aliases: ["call", "ticket", "sales", "channel"],
  },
  {
    id: "edit-delete",
    question: "Who can edit or delete audits?",
    answer:
      "Editing and deletion depend on the signed-in user's role and the audit state. Admin and QA permissions usually control these actions.",
    roles: ["admin", "qa"],
    aliases: ["delete", "edit", "permission", "role"],
  },
];

const PAGE_HELP: Record<string, PageHelp> = {
  dashboard: {
    key: "dashboard",
    title: "Dashboard",
    description: "Use the Dashboard to understand overall QA health at a glance.",
    tips: [
      "KPI cards summarize core performance indicators for the selected view.",
      "Trends help spot quality movement over time instead of relying on one audit.",
      "Recognition and trophy cabinet areas highlight wins and standout performance.",
    ],
    aliases: ["kpi", "trend", "recognition", "trophy", "home"],
  },
  auditsList: {
    key: "auditsList",
    title: "Audits List",
    description: "Use Audits List to review saved audits, visibility state, and release controls.",
    tips: [
      "Filters narrow audits by agent, team, channel, date range, score, or status.",
      "Hidden and shared states help control what appears in released views.",
      "Scores and release controls should be reviewed before sharing results broadly.",
    ],
    aliases: ["filters", "hidden", "shared", "release", "audit list"],
  },
  newAudit: {
    key: "newAudit",
    title: "New Audit",
    description: "Use New Audit to create a structured QA review for an agent interaction.",
    tips: [
      "Select the correct agent and team before scoring.",
      "Choose the right metrics for the audit channel and interaction type.",
      "The score updates from selected metric outcomes before the audit is saved.",
    ],
    aliases: ["score", "agent", "team", "metric", "calculation"],
  },
  reports: {
    key: "reports",
    title: "Reports",
    description: "Use Reports to analyze QA performance across teams, agents, channels, and time.",
    tips: [
      "Filters and multi-agent selections control which records are included.",
      "Exports should reflect the currently selected report criteria.",
      "Trend views help compare performance over time instead of one snapshot.",
    ],
    aliases: ["filters", "multi-agent", "exports", "trend", "analytics"],
  },
  monitoring: {
    key: "monitoring",
    title: "Monitoring",
    description: "Use Monitoring to track active quality alerts and coaching opportunities.",
    tips: [
      "Active alerts call attention to items that may need review.",
      "Coaching items help supervisors and QA staff prioritize follow-up.",
      "Review alert context before deciding whether action is needed.",
    ],
    aliases: ["alerts", "coaching", "monitor"],
  },
  accounts: {
    key: "accounts",
    title: "Accounts",
    description: "Use Accounts to manage users, permissions, roles, and account recovery support.",
    tips: [
      "Roles determine which parts of the QA system a user can access.",
      "User management changes should match the person's actual workflow.",
      "Password reset actions help users recover access without changing QA data.",
    ],
    aliases: ["roles", "users", "password", "permissions"],
  },
  uploads: {
    key: "uploads",
    title: "Uploads",
    description: "Use upload pages to bring audit, call, ticket, evidence, or sales data into the QA workflow.",
    tips: [
      "Confirm file format and required columns before importing.",
      "Review mapped fields, dates, teams, agents, identifiers, and score fields before saving.",
      "Use validation messages as a cleanup checklist before relying on uploaded data.",
    ],
    aliases: ["upload", "import", "calls", "tickets", "sales", "evidence"],
  },
  agentFeedback: {
    key: "agentFeedback",
    title: "Agent Feedback",
    description: "Use Agent Feedback to review agent-facing QA notes, coaching context, and response status.",
    tips: [
      "Look for patterns across feedback instead of reacting to one isolated note.",
      "Use clear evidence-backed comments when feedback needs follow-up.",
      "Confirm intended visibility before sharing sensitive coaching context.",
    ],
    aliases: ["feedback", "agent", "coaching"],
  },
  supervisor: {
    key: "supervisor",
    title: "Supervisor Workspace",
    description: "Use supervisor pages to monitor team QA status, coaching priorities, and request activity.",
    tips: [
      "Start with team-level indicators before drilling into one agent.",
      "Use request and coaching context together to prioritize follow-up.",
      "Compare trends over time before drawing conclusions from one audit.",
    ],
    aliases: ["supervisor", "team dashboard", "requests", "coaching"],
  },
  profile: {
    key: "profile",
    title: "Profile",
    description: "Use Profile to confirm account information, role, team, and agent identifiers.",
    tips: [
      "Your role controls which navigation items and actions are available.",
      "Check agent ID and team if reports or audits do not line up as expected.",
      "Contact an admin if account details need correction.",
    ],
    aliases: ["account", "role", "team", "agent id"],
  },
  default: {
    key: "default",
    title: "General QA System Help",
    description: "The Detroit Axle QA System helps teams create audits, review performance, monitor coaching needs, and report quality trends.",
    tips: [
      "Use the sidebar to move between audit workflows, data uploads, analytics, and management tools.",
      "Use Search to quickly jump to a page or answer.",
      "Use this Help Center for quick guidance without leaving your current page.",
    ],
    aliases: ["help", "qa", "workspace", "support"],
  },
};

const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    key: "help-system-v3",
    title: "Help Center v3",
    description:
      "Adds role-aware help, guided tours, searchable guides, support submissions, admin help editing, and usage analytics hooks.",
    roles: ["all"],
  },
  {
    key: "support-workflow",
    title: "Support requests now capture context",
    description:
      "Issue, feature, and admin requests include current page, path, role, browser, and timestamp so admins can investigate faster.",
    roles: ["admin", "qa", "supervisor", "agent"],
  },
];

const TOURS: readonly TourItem[] = [
  {
    id: "dashboard",
    title: "Dashboard tour",
    description: "Walk through KPI cards, trends, recognition, and performance context.",
    roles: ["admin", "qa"],
    aliases: ["kpi", "dashboard", "overview"],
  },
  {
    id: "newAudit",
    title: "New Audit tour",
    description: "Review agent selection, metric scoring, notes, and save checks.",
    roles: ["admin", "qa"],
    aliases: ["audit", "score", "metrics"],
  },
  {
    id: "reports",
    title: "Reports tour",
    description: "Review filters, multi-agent views, exports, and trends.",
    roles: ["admin", "qa", "supervisor"],
    aliases: ["reports", "exports", "filters"],
  },
  {
    id: "auditsList",
    title: "Audits List tour",
    description: "Review filters, hidden/shared states, and release controls.",
    roles: ["admin", "qa", "supervisor"],
    aliases: ["audits list", "hidden", "release"],
  },
  {
    id: "supervisor",
    title: "Supervisor workflow tour",
    description: "Walk through team-level QA signals and coaching priorities.",
    roles: ["supervisor", "admin"],
    aliases: ["team", "coaching", "supervisor"],
  },
];

const SUPPORT_ACTIONS: readonly { label: string; type: SupportRequestType; description: string }[] = [
  { label: "Report an issue", type: "issue", description: "Something is broken, confusing, or blocking work." },
  { label: "Request a feature", type: "feature", description: "Suggest an improvement for the QA workflow." },
  { label: "Contact admin", type: "admin", description: "Ask for account, role, report, or workflow help." },
];

const emptySupportForm: SupportFormState = {
  title: "",
  description: "",
  expected: "",
  actual: "",
  steps: "",
};

function roleCanSee(roles: readonly HelpRole[], currentRole?: string): boolean {
  if (roles.includes("all")) return true;
  const normalizedRole = (currentRole || "agent").toLowerCase();
  return roles.map((role) => role.toLowerCase()).includes(normalizedRole);
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

function readStringArray(content: unknown, key: string): readonly string[] {
  if (!isRecord(content)) return [];
  const value = content[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeRoles(row: HelpContentRow): readonly HelpRole[] {
  return row.roles && row.roles.length > 0 ? row.roles : ["all"];
}

function normalizeManagedHelpRows(rows: readonly HelpContentRow[]): ManagedHelpContent {
  const guides: Guide[] = [];
  const faqs: FaqItem[] = [];
  const releaseNotes: ReleaseNote[] = [];
  const pages: Record<string, PageHelp> = {};
  const tours: TourItem[] = [];

  rows.forEach((row) => {
    const roles = normalizeRoles(row);
    if (row.content_type === "guide") {
      guides.push({
        key: row.content_key,
        title: row.title,
        description: readContentString(row.content, ["description", "body", "text"]),
        roles,
        aliases: readStringArray(row.content, "aliases"),
      });
    }

    if (row.content_type === "faq") {
      faqs.push({
        id: row.content_key,
        question: row.title,
        answer: readContentString(row.content, ["answer", "body", "text"]),
        roles,
        aliases: readStringArray(row.content, "aliases"),
      });
    }

    if (row.content_type === "release_note") {
      releaseNotes.push({
        key: row.content_key,
        title: row.title,
        description: readContentString(row.content, ["description", "body", "text"]),
        roles,
      });
    }

    if (row.content_type === "page") {
      pages[row.content_key] = {
        key: row.content_key,
        title: row.title,
        description: readContentString(row.content, ["description", "body", "text"]),
        tips: readStringArray(row.content, "tips"),
        aliases: readStringArray(row.content, "aliases"),
      };
    }

    if (row.content_type === "tour") {
      tours.push({
        id: row.content_key,
        title: row.title,
        description: readContentString(row.content, ["description", "body", "text"]),
        roles,
        aliases: readStringArray(row.content, "aliases"),
      });
    }
  });

  return { guides, faqs, releaseNotes, pages, tours };
}

function mergeByKey<T extends { readonly key: string }>(base: readonly T[], managed: readonly T[]): readonly T[] {
  const map = new Map<string, T>();
  base.forEach((item) => map.set(item.key, item));
  managed.forEach((item) => map.set(item.key, item));
  return Array.from(map.values());
}

function mergeFaqs(managedFaqs: readonly FaqItem[]): readonly FaqItem[] {
  const map = new Map<string, FaqItem>();
  FAQS.forEach((item) => map.set(item.id, item));
  managedFaqs.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function mergeTours(managedTours: readonly TourItem[]): readonly TourItem[] {
  const map = new Map<string, TourItem>();
  TOURS.forEach((item) => map.set(item.id, item));
  managedTours.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function mergePages(managedPages: Record<string, PageHelp>): Record<string, PageHelp> {
  return { ...PAGE_HELP, ...managedPages };
}

function resolvePageHelp(currentPage?: string, pages: Record<string, PageHelp> = PAGE_HELP): PageHelp {
  const value = (currentPage ?? "").toLowerCase();
  if (value.includes("dashboard") || value === "/" || value.endsWith(" /")) return pages.dashboard || PAGE_HELP.dashboard;
  if (value.includes("audits list") || value.includes("/audits-list")) return pages.auditsList || PAGE_HELP.auditsList;
  if (value.includes("new audit") || value.includes("/new-audit")) return pages.newAudit || PAGE_HELP.newAudit;
  if (value.includes("reports") || value.includes("/reports")) return pages.reports || PAGE_HELP.reports;
  if (value.includes("monitoring") || value.includes("/monitoring")) return pages.monitoring || PAGE_HELP.monitoring;
  if (value.includes("accounts") || value.includes("/accounts")) return pages.accounts || PAGE_HELP.accounts;
  if (value.includes("upload") || value.includes("/calls-upload") || value.includes("/tickets-upload") || value.includes("/sales-upload") || value.includes("/ticket-evidence")) return pages.uploads || PAGE_HELP.uploads;
  if (value.includes("agent feedback") || value.includes("/agent-feedback")) return pages.agentFeedback || PAGE_HELP.agentFeedback;
  if (value.includes("supervisor") || value.includes("team dashboard") || value.includes("/supervisor")) return pages.supervisor || PAGE_HELP.supervisor;
  if (value.includes("profile") || value.includes("/profile")) return pages.profile || PAGE_HELP.profile;
  return pages.default || PAGE_HELP.default;
}

function includesQuery(query: string, parts: readonly string[]): boolean {
  if (!query) return true;
  const haystack = parts.join(" ").toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function highlightText(text: string, query: string): ReactNode {
  const term = query.trim().split(/\s+/).filter(Boolean)[0]?.toLowerCase();
  if (!term) return text;
  const index = text.toLowerCase().indexOf(term);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark style={{ background: "color-mix(in srgb, var(--accent-amber) 24%, transparent)", color: "inherit", borderRadius: "4px", padding: "0 2px" }}>
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
}

async function copyText(value: string): Promise<boolean> {
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

function buildGuideMarkdown(guide: Guide): string {
  return [`# ${guide.title}`, "", guide.description, "", "Source: Detroit Axle QA System Help Center"].join("\n");
}

function downloadGuide(guide: Guide) {
  const blob = new Blob([buildGuideMarkdown(guide)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${guide.key || "help-guide"}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function printGuide(guide: Guide) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=760,height=900");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${guide.title}</title><style>body{font-family:Inter,system-ui,sans-serif;padding:32px;line-height:1.6;color:#111827}h1{font-size:26px}</style></head><body><h1>${guide.title}</h1><p>${guide.description}</p></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function supportLabel(type: SupportRequestType): string {
  if (type === "feature") return "Feature request";
  if (type === "admin") return "Admin contact";
  return "Issue report";
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
  fontWeight: 800,
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
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--accent-blue)",
  marginBottom: "8px",
};

const pillButtonStyle: CSSProperties = {
  height: "30px",
  padding: "0 10px",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  background: "var(--bg-subtle)",
  color: "var(--fg-muted)",
  fontSize: "11px",
  fontWeight: 700,
};

function HelpDrawer({
  open,
  onClose,
  currentPage,
  currentRole,
  currentUserName,
  currentUserEmail,
  onNavigate,
  onStartTour,
}: HelpDrawerProps) {
  const [query, setQuery] = useState("");
  const [openFaqId, setOpenFaqId] = useState<string>("hidden-audits");
  const [supportMessage, setSupportMessage] = useState("");
  const [activeSupportType, setActiveSupportType] = useState<SupportRequestType | null>(null);
  const [supportForm, setSupportForm] = useState<SupportFormState>(emptySupportForm);
  const [managedHelp, setManagedHelp] = useState<ManagedHelpContent | null>(null);
  const [managedHelpLoaded, setManagedHelpLoaded] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const allGuides = useMemo(
    () => mergeByKey(GUIDES, managedHelp?.guides ?? []).filter((guide) => roleCanSee(guide.roles, currentRole)),
    [currentRole, managedHelp]
  );
  const allFaqs = useMemo(
    () => mergeFaqs(managedHelp?.faqs ?? []).filter((faq) => roleCanSee(faq.roles, currentRole)),
    [currentRole, managedHelp]
  );
  const allReleaseNotes = useMemo(
    () => mergeByKey(RELEASE_NOTES, managedHelp?.releaseNotes ?? []).filter((note) => roleCanSee(note.roles, currentRole)),
    [currentRole, managedHelp]
  );
  const allTours = useMemo(
    () => mergeTours(managedHelp?.tours ?? []).filter((tour) => roleCanSee(tour.roles, currentRole)),
    [currentRole, managedHelp]
  );
  const pages = useMemo(() => mergePages(managedHelp?.pages ?? {}), [managedHelp]);
  const pageHelp = useMemo(() => resolvePageHelp(currentPage, pages), [currentPage, pages]);

  useEffect(() => {
    if (!open || managedHelpLoaded || !hasHelpSystemBackend()) return;
    const controller = new AbortController();
    fetchActiveHelpContent(controller.signal)
      .then((rows) => setManagedHelp(normalizeManagedHelpRows(rows)))
      .catch(() => undefined)
      .finally(() => setManagedHelpLoaded(true));
    return () => controller.abort();
  }, [managedHelpLoaded, open]);

  useEffect(() => {
    if (!open) return;
    recordHelpEvent({
      event_name: "help_opened",
      current_page: currentPage,
      user_role: currentRole,
    });
  }, [currentPage, currentRole, open]);

  useEffect(() => {
    if (!open || !normalizedQuery) return;
    const timeoutId = window.setTimeout(() => {
      recordHelpEvent({
        event_name: "help_search",
        current_page: currentPage,
        user_role: currentRole,
        query: normalizedQuery,
      });
    }, 450);
    return () => window.clearTimeout(timeoutId);
  }, [currentPage, currentRole, normalizedQuery, open]);

  const filteredQuickActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) => roleCanSee(action.roles, currentRole)).filter((action) =>
        includesQuery(normalizedQuery, [action.label, action.description, action.path, ...action.aliases, "quick actions"])
      ),
    [currentRole, normalizedQuery]
  );

  const filteredGuides = useMemo(
    () =>
      allGuides.filter((guide) =>
        includesQuery(normalizedQuery, [guide.title, guide.description, ...guide.aliases, "guide"])
      ),
    [allGuides, normalizedQuery]
  );

  const filteredFaqs = useMemo(
    () =>
      allFaqs.filter((faq) =>
        includesQuery(normalizedQuery, [faq.question, faq.answer, ...faq.aliases, "faq"])
      ),
    [allFaqs, normalizedQuery]
  );

  const filteredReleaseNotes = useMemo(
    () =>
      allReleaseNotes.filter((note) => includesQuery(normalizedQuery, [note.title, note.description, "what's new", "release notes"])),
    [allReleaseNotes, normalizedQuery]
  );

  const filteredTours = useMemo(
    () =>
      allTours.filter((tour) => includesQuery(normalizedQuery, [tour.title, tour.description, ...tour.aliases, "tour", "onboarding"])),
    [allTours, normalizedQuery]
  );

  const filteredSupportActions = useMemo(
    () => SUPPORT_ACTIONS.filter((action) => includesQuery(normalizedQuery, [action.label, action.description, "support"])),
    [normalizedQuery]
  );

  const showPageHelp = includesQuery(normalizedQuery, [
    pageHelp.title,
    pageHelp.description,
    ...pageHelp.tips,
    ...pageHelp.aliases,
    "this page",
    "current page",
    "context",
  ]);

  const hasResults =
    filteredQuickActions.length > 0 ||
    showPageHelp ||
    filteredTours.length > 0 ||
    filteredGuides.length > 0 ||
    filteredFaqs.length > 0 ||
    filteredReleaseNotes.length > 0 ||
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
      setActiveSupportType(null);
      setSupportForm(emptySupportForm);
    }
  }, [open]);

  const handleNavigate = (path: string) => {
    if (!onNavigate) return;
    recordHelpEvent({ event_name: "help_quick_action", current_page: currentPage, user_role: currentRole, target: path });
    onNavigate(path);
    onClose();
  };

  const openSupportForm = (type: SupportRequestType, title?: string) => {
    setActiveSupportType(type);
    setSupportMessage("");
    setSupportForm({
      title: title || supportLabel(type),
      description: normalizedQuery ? `I searched Help for: ${normalizedQuery}` : "",
      expected: "",
      actual: "",
      steps: "",
    });
  };

  const submitSupportRequest = async () => {
    if (!activeSupportType) return;
    const title = supportForm.title.trim();
    const description = supportForm.description.trim();
    if (!title || !description) {
      setSupportMessage("Title and description are required before submitting.");
      return;
    }

    const draft = [
      `Type: ${supportLabel(activeSupportType)}`,
      `Title: ${title}`,
      `Page: ${currentPage || "Unknown"}`,
      `Path: ${getCurrentHelpPath()}`,
      `Role: ${currentRole || "Unknown"}`,
      `User: ${currentUserName || currentUserEmail || "Unknown"}`,
      "",
      description,
      supportForm.expected ? `\nExpected:\n${supportForm.expected}` : "",
      supportForm.actual ? `\nActual:\n${supportForm.actual}` : "",
      supportForm.steps ? `\nSteps:\n${supportForm.steps}` : "",
    ].join("\n");

    try {
      await createSupportRequest({
        request_type: activeSupportType,
        title,
        description,
        expected_result: supportForm.expected.trim() || undefined,
        actual_result: supportForm.actual.trim() || undefined,
        steps_to_reproduce: supportForm.steps.trim() || undefined,
        current_page: currentPage,
        current_path: getCurrentHelpPath(),
        user_name: currentUserName,
        user_email: currentUserEmail,
        user_role: currentRole,
      });
      recordHelpEvent({ event_name: "support_submitted", current_page: currentPage, user_role: currentRole, target: activeSupportType });
      setSupportMessage("Submitted. An admin can review it in Support Inbox.");
      setActiveSupportType(null);
      setSupportForm(emptySupportForm);
    } catch {
      const copied = await copyText(draft);
      setSupportMessage(
        copied
          ? "Backend submit was unavailable, so the request was copied. Paste it into your support channel or email."
          : "Backend submit was unavailable and clipboard access was blocked. Copy the request details manually."
      );
    }
  };

  return (
    <div aria-hidden={!open} style={{ ...overlayStyleBase, pointerEvents: open ? "auto" : "none" }}>
      <div
        onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        style={{
          position: "absolute",
          inset: 0,
          background: "color-mix(in srgb, var(--bg-base) 34%, rgba(0, 0, 0, 0.54))",
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
          width: "min(520px, 100vw)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderLeft: "1px solid var(--border-strong)",
          borderTopLeftRadius: "20px",
          borderBottomLeftRadius: "20px",
          background: "linear-gradient(180deg, var(--bg-elevated), var(--bg-overlay))",
          boxShadow: "var(--shadow-lg)",
          opacity: open ? 1 : 0.98,
          transform: open ? "translateX(0)" : "translateX(104%)",
          transition: "transform 260ms var(--ease-out), opacity 180ms ease",
          willChange: "transform",
        }}
      >
        <header style={{ padding: "20px", borderBottom: "1px solid var(--border)", background: "var(--header-bg)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px" }}>
            <div>
              <div style={smallLabelStyle}>Help</div>
              <h2 id="help-drawer-title" style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--fg-default)", letterSpacing: "-0.03em" }}>
                Help Center
              </h2>
              <p id="help-drawer-subtitle" style={{ margin: "5px 0 0", fontSize: "13px", color: "var(--fg-muted)" }}>
                Detroit Axle QA System {currentRole ? `• ${currentRole}` : ""}
              </p>
            </div>

            <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close Help Center" title="Close" style={closeButtonStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", height: "40px", marginTop: "18px", padding: "0 12px", borderRadius: "12px", border: "1px solid var(--border-strong)", background: "var(--bg-elevated)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fg-muted)", flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help, guides, or actions..."
              aria-label="Search help, guides, or actions"
              style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", color: "var(--fg-default)", font: "inherit", fontSize: "13px" }}
            />
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {!hasResults && (
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>No help results</h3>
              <p style={sectionSubtitleStyle}>Try searching for scoring, reports, audits, roles, support, exports, hidden audits, or target.</p>
              <button type="button" onClick={() => openSupportForm("feature", "Missing help article request")} style={{ ...pillButtonStyle, marginTop: "12px" }}>
                Report missing help article
              </button>
            </section>
          )}

          {filteredQuickActions.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-quick-actions">
              <div style={smallLabelStyle}>Quick Actions</div>
              <h3 id="help-quick-actions" style={sectionTitleStyle}>Jump to common tasks</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "12px" }}>
                {filteredQuickActions.map((action) => {
                  const disabled = !onNavigate;
                  return (
                    <button key={action.label} type="button" disabled={disabled} onClick={() => handleNavigate(action.path)} style={{ minHeight: "82px", padding: "12px", borderRadius: "13px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: disabled ? "var(--fg-subtle)" : "var(--fg-default)", textAlign: "left", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.68 : 1 }}>
                      <span style={{ display: "block", fontSize: "13px", fontWeight: 800, letterSpacing: "-0.01em" }}>{highlightText(action.label, normalizedQuery)}</span>
                      <span style={{ display: "block", marginTop: "5px", fontSize: "11px", lineHeight: 1.45, color: "var(--fg-muted)" }}>{highlightText(action.description, normalizedQuery)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {showPageHelp && (
            <section style={sectionStyle} aria-labelledby="help-this-page">
              <div style={smallLabelStyle}>This Page</div>
              <h3 id="help-this-page" style={sectionTitleStyle}>{highlightText(pageHelp.title, normalizedQuery)}</h3>
              <p style={sectionSubtitleStyle}>{highlightText(pageHelp.description, normalizedQuery)}</p>
              <ul style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                {pageHelp.tips.map((tip) => (
                  <li key={tip} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", lineHeight: 1.55, color: "var(--fg-muted)" }}>
                    <span aria-hidden="true" style={{ width: "6px", height: "6px", marginTop: "7px", borderRadius: "999px", background: "var(--accent-blue)", flexShrink: 0 }} />
                    {highlightText(tip, normalizedQuery)}
                  </li>
                ))}
              </ul>
              {onStartTour && (
                <button type="button" onClick={() => onStartTour(pageHelp.key === "default" ? "general" : pageHelp.key)} style={{ ...pillButtonStyle, marginTop: "13px", color: "var(--fg-default)" }}>
                  Start this page tour
                </button>
              )}
            </section>
          )}

          {filteredTours.length > 0 && onStartTour && (
            <section style={sectionStyle} aria-labelledby="help-tours">
              <div style={smallLabelStyle}>Tours</div>
              <h3 id="help-tours" style={sectionTitleStyle}>Guided onboarding</h3>
              <div style={{ display: "grid", gap: "9px", marginTop: "12px" }}>
                {filteredTours.map((tour) => (
                  <button key={tour.id} type="button" onClick={() => onStartTour(tour.id)} style={{ padding: "12px", borderRadius: "13px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--fg-default)", textAlign: "left" }}>
                    <strong style={{ display: "block", fontSize: "13px" }}>{highlightText(tour.title, normalizedQuery)}</strong>
                    <span style={{ display: "block", marginTop: "5px", fontSize: "12px", lineHeight: 1.5, color: "var(--fg-muted)" }}>{highlightText(tour.description, normalizedQuery)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {filteredGuides.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-guides">
              <div style={smallLabelStyle}>Guides</div>
              <h3 id="help-guides" style={sectionTitleStyle}>Learn the workflow</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginTop: "12px" }}>
                {filteredGuides.map((guide) => (
                  <article key={guide.key} style={{ padding: "12px", borderRadius: "13px", border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                    <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "var(--fg-default)", letterSpacing: "-0.01em" }}>{highlightText(guide.title, normalizedQuery)}</h4>
                    <p style={{ margin: "5px 0 0", fontSize: "12px", lineHeight: 1.55, color: "var(--fg-muted)" }}>{highlightText(guide.description, normalizedQuery)}</p>
                    <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "10px" }}>
                      <button type="button" onClick={() => copyText(buildGuideMarkdown(guide)).then((copied) => setSupportMessage(copied ? "Guide copied." : "Could not copy guide."))} style={pillButtonStyle}>Copy</button>
                      <button type="button" onClick={() => downloadGuide(guide)} style={pillButtonStyle}>Download</button>
                      <button type="button" onClick={() => printGuide(guide)} style={pillButtonStyle}>Print</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {filteredReleaseNotes.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-release-notes">
              <div style={smallLabelStyle}>What's New</div>
              <h3 id="help-release-notes" style={sectionTitleStyle}>Recent Help updates</h3>
              <div style={{ display: "grid", gap: "9px", marginTop: "12px" }}>
                {filteredReleaseNotes.map((note) => (
                  <article key={note.key} style={{ padding: "12px", borderRadius: "13px", border: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                    <h4 style={{ margin: 0, fontSize: "13px", color: "var(--fg-default)" }}>{highlightText(note.title, normalizedQuery)}</h4>
                    <p style={{ margin: "5px 0 0", fontSize: "12px", lineHeight: 1.55, color: "var(--fg-muted)" }}>{highlightText(note.description, normalizedQuery)}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {filteredFaqs.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-faq">
              <div style={smallLabelStyle}>FAQ</div>
              <h3 id="help-faq" style={sectionTitleStyle}>Common questions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                {filteredFaqs.map((faq) => {
                  const expanded = openFaqId === faq.id || Boolean(normalizedQuery);
                  const panelId = `help-faq-${faq.id}`;
                  return (
                    <div key={faq.id} style={{ borderRadius: "13px", border: "1px solid var(--border)", background: "var(--bg-elevated)", overflow: "hidden" }}>
                      <button type="button" onClick={() => setOpenFaqId((current) => (current === faq.id ? "" : faq.id))} aria-expanded={expanded} aria-controls={panelId} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "12px", border: 0, background: "transparent", color: "var(--fg-default)", textAlign: "left", fontSize: "13px", fontWeight: 800 }}>
                        {highlightText(faq.question, normalizedQuery)}
                        <span aria-hidden="true" style={{ color: "var(--fg-muted)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 160ms var(--ease-out)" }}>▾</span>
                      </button>
                      {expanded && <div id={panelId} style={{ padding: "0 12px 12px", fontSize: "12px", lineHeight: 1.55, color: "var(--fg-muted)" }}>{highlightText(faq.answer, normalizedQuery)}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {filteredSupportActions.length > 0 && (
            <section style={sectionStyle} aria-labelledby="help-support">
              <div style={smallLabelStyle}>Support</div>
              <h3 id="help-support" style={sectionTitleStyle}>Need more help?</h3>
              <p style={sectionSubtitleStyle}>Submit an issue, feature request, or admin question with page context and browser details attached.</p>
              {supportMessage && <div role="status" style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "12px", border: "1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent)", background: "color-mix(in srgb, var(--accent-emerald) 10%, transparent)", color: "var(--fg-default)", fontSize: "12px", lineHeight: 1.45 }}>{supportMessage}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "9px", marginTop: "12px" }}>
                {filteredSupportActions.map((action) => (
                  <button key={action.type} type="button" onClick={() => openSupportForm(action.type)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "42px", padding: "0 12px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--fg-default)", fontSize: "13px", fontWeight: 750 }}>
                    <span>
                      {highlightText(action.label, normalizedQuery)}
                      <span style={{ display: "block", marginTop: "2px", color: "var(--fg-muted)", fontSize: "11px", fontWeight: 500 }}>{highlightText(action.description, normalizedQuery)}</span>
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--fg-muted)" }}>→</span>
                  </button>
                ))}
              </div>

              {activeSupportType && (
                <div style={{ marginTop: "12px", padding: "12px", borderRadius: "14px", border: "1px solid var(--border)", background: "var(--bg-elevated)", display: "grid", gap: "10px" }}>
                  <strong style={{ color: "var(--fg-default)", fontSize: "13px" }}>{supportLabel(activeSupportType)}</strong>
                  <input value={supportForm.title} onChange={(event) => setSupportForm((current) => ({ ...current, title: event.target.value }))} placeholder="Short title" style={inputStyle} />
                  <textarea value={supportForm.description} onChange={(event) => setSupportForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe what you need..." style={textareaStyle} />
                  <textarea value={supportForm.expected} onChange={(event) => setSupportForm((current) => ({ ...current, expected: event.target.value }))} placeholder="Expected result (optional)" style={textareaStyle} />
                  <textarea value={supportForm.actual} onChange={(event) => setSupportForm((current) => ({ ...current, actual: event.target.value }))} placeholder="Actual result (optional)" style={textareaStyle} />
                  <textarea value={supportForm.steps} onChange={(event) => setSupportForm((current) => ({ ...current, steps: event.target.value }))} placeholder="Steps to reproduce or suggested workflow (optional)" style={textareaStyle} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="button" onClick={submitSupportRequest} style={{ ...pillButtonStyle, color: "var(--fg-default)", background: "color-mix(in srgb, var(--accent-blue) 14%, transparent)", borderColor: "color-mix(in srgb, var(--accent-blue) 30%, transparent)" }}>Submit</button>
                    <button type="button" onClick={() => setActiveSupportType(null)} style={pillButtonStyle}>Cancel</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "38px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-subtle)",
  color: "var(--fg-default)",
  padding: "0 11px",
  outline: "none",
  font: "inherit",
  fontSize: "13px",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "74px",
  padding: "10px 11px",
  resize: "vertical",
};

export default HelpDrawer;
