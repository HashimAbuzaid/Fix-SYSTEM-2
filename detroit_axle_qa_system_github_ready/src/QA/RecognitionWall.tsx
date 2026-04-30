import { useEffect, useMemo, useState, memo, type CSSProperties } from "react";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type TeamName = "Calls" | "Tickets" | "Sales";

type Viewer = {
  id?: string;
  role?: "admin" | "qa" | "agent" | "supervisor";
  team?: TeamName | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName | string;
  audit_date: string;
  quality_score: number;
  shared_with_agent?: boolean | null;
};

type CallsRecord = {
  agent_id: string;
  agent_name: string;
  calls_count: number;
  call_date?: string | null;
  date_to?: string | null;
};

type TicketsRecord = {
  agent_id: string;
  agent_name: string;
  tickets_count: number;
  ticket_date?: string | null;
  date_to?: string | null;
};

type SalesRecord = {
  agent_id: string;
  agent_name: string;
  amount: number;
  sale_date?: string | null;
  date_to?: string | null;
};

type AgentProfile = {
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
};

type RecognitionKind = "quality" | "volume" | "released";

type RecognitionEntry = {
  title: string;
  value: string;
  subtitle: string;
  badge: string;
  helper: string;
  kind: RecognitionKind;
  team?: TeamName | null;
  sampleSize?: number;
  rank?: number; // 1-based rank for podium effect
};

type RecognitionWallProps = {
  title?: string;
  compact?: boolean;
  currentUser?: Viewer | null;
};

// ─────────────────────────────────────────────────────────────
// CSS injection — uses the app's existing CSS variable system
// ─────────────────────────────────────────────────────────────

const RW_CSS_ID = "da-recognition-wall-v4";
const RW_CSS = `
/* ── Keyframes ────────────────────────────────────────────── */
@keyframes rwFadeUp   { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
@keyframes rwFadeIn   { from { opacity:0 }                              to { opacity:1 } }
@keyframes rwScaleIn  { from { opacity:0; transform:scale(0.94) }       to { opacity:1; transform:scale(1) } }
@keyframes rwShimmer  { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
@keyframes rwGlow     { 0%,100% { opacity:0.5 } 50% { opacity:1 } }
@keyframes rwCountUp  { from { clip-path:inset(100% 0 0 0) } to { clip-path:inset(0 0 0 0) } }
@keyframes rwPulse    { 0%,100% { transform:scale(1) } 50% { transform:scale(1.03) } }
@keyframes rwRotate   { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
@keyframes rwTick     { 0% { stroke-dashoffset: 283 } 100% { stroke-dashoffset: 0 } }

/* ── Shell ─────────────────────────────────────────────────── */
.rw-root { display:flex; flex-direction:column; gap:0; font-family:inherit; }
.rw-root * { box-sizing:border-box; }

/* ── Header ────────────────────────────────────────────────── */
.rw-eyebrow {
  display:inline-flex; align-items:center; gap:6px;
  height:22px; padding:0 10px; border-radius:999px;
  background:color-mix(in srgb,var(--accent-amber) 12%,transparent);
  border:1px solid color-mix(in srgb,var(--accent-amber) 22%,transparent);
  font-size:10px; font-weight:700; letter-spacing:0.12em;
  text-transform:uppercase; color:var(--accent-amber);
  margin-bottom:10px; width:fit-content;
  animation:rwFadeIn 300ms ease both;
}
.rw-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:16px; margin-bottom:20px; flex-wrap:wrap;
  animation:rwFadeUp 280ms ease both;
}
.rw-title {
  font-size:20px; font-weight:800; letter-spacing:-0.03em;
  color:var(--fg-default); line-height:1.15; margin-bottom:4px;
}
.rw-subtitle {
  font-size:12px; color:var(--fg-muted); line-height:1.6;
}
.rw-month-pill {
  display:inline-flex; align-items:center; gap:5px;
  height:28px; padding:0 12px; border-radius:999px;
  border:1px solid var(--border-strong);
  background:var(--bg-elevated);
  font-size:11px; font-weight:600; color:var(--fg-muted);
  flex-shrink:0; white-space:nowrap;
}

/* ── Grid ──────────────────────────────────────────────────── */
.rw-grid {
  display:grid;
  gap:14px;
  animation:rwFadeUp 360ms ease both;
}

/* ── Card ──────────────────────────────────────────────────── */
.rw-card {
  position:relative; overflow:hidden;
  background:var(--bg-elevated);
  border:1px solid var(--border);
  border-radius:18px;
  padding:22px 24px 20px;
  display:flex; flex-direction:column; gap:0;
  transition:border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  cursor:default;
  animation:rwScaleIn 340ms var(--ease-out, cubic-bezier(0.16,1,0.3,1)) both;
}
.rw-card:hover {
  border-color:var(--border-strong);
  box-shadow:0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  transform:translateY(-2px);
}

/* Card accent glow (top edge) */
.rw-card-glow {
  position:absolute; top:0; left:0; right:0; height:2px;
  border-radius:18px 18px 0 0;
}

/* Large background number watermark */
.rw-card-watermark {
  position:absolute; right:-10px; bottom:-20px;
  font-size:120px; font-weight:900; line-height:1;
  opacity:0.04; letter-spacing:-0.06em; pointer-events:none;
  user-select:none; color:var(--fg-default);
}

/* ── Card: Champion (quality) ──────────────────────────────── */
.rw-card--quality {
  background:linear-gradient(
    145deg,
    color-mix(in srgb,var(--accent-amber) 6%,var(--bg-elevated)) 0%,
    var(--bg-elevated) 60%
  );
}
.rw-card--quality:hover {
  border-color:color-mix(in srgb,var(--accent-amber) 30%,transparent);
}

/* ── Card: Volume ──────────────────────────────────────────── */
.rw-card--volume {
  background:linear-gradient(
    145deg,
    color-mix(in srgb,var(--accent-blue) 5%,var(--bg-elevated)) 0%,
    var(--bg-elevated) 60%
  );
}
.rw-card--volume:hover {
  border-color:color-mix(in srgb,var(--accent-blue) 28%,transparent);
}

/* ── Card: Released ────────────────────────────────────────── */
.rw-card--released {
  background:linear-gradient(
    145deg,
    color-mix(in srgb,var(--accent-emerald) 5%,var(--bg-elevated)) 0%,
    var(--bg-elevated) 60%
  );
}
.rw-card--released:hover {
  border-color:color-mix(in srgb,var(--accent-emerald) 28%,transparent);
}

/* ── Badge ─────────────────────────────────────────────────── */
.rw-badge {
  display:inline-flex; align-items:center; gap:4px;
  height:20px; padding:0 8px; border-radius:5px;
  font-size:10px; font-weight:700; letter-spacing:0.06em;
  text-transform:uppercase; white-space:nowrap;
  margin-bottom:14px; width:fit-content;
}

/* ── Trophy icon ───────────────────────────────────────────── */
.rw-trophy {
  font-size:28px; margin-bottom:10px; display:block;
  animation:rwPulse 2.8s ease-in-out infinite;
  animation-delay:var(--card-delay, 0ms);
  width:fit-content;
}

/* ── Card title ────────────────────────────────────────────── */
.rw-card-title {
  font-size:13px; font-weight:700; color:var(--fg-muted);
  letter-spacing:0.01em; margin-bottom:10px;
  text-transform:uppercase; font-size:10px;
  letter-spacing:0.1em;
}

/* ── Value (big number) ────────────────────────────────────── */
.rw-value {
  font-size:46px; font-weight:900; line-height:1;
  letter-spacing:-0.05em; margin-bottom:10px;
  animation:rwCountUp 500ms var(--ease-out, cubic-bezier(0.16,1,0.3,1)) both;
  animation-delay:var(--card-delay, 0ms);
}

/* ── Agent name ────────────────────────────────────────────── */
.rw-agent {
  font-size:14px; font-weight:700; color:var(--fg-default);
  letter-spacing:-0.01em; line-height:1.35;
  margin-bottom:6px; display:flex; align-items:center; gap:6px;
}
.rw-agent-id {
  font-size:11px; color:var(--fg-muted); font-weight:500;
  font-family:var(--font-mono, monospace); letter-spacing:0.02em;
}

/* ── Helper text ───────────────────────────────────────────── */
.rw-helper {
  font-size:11px; color:var(--fg-muted); line-height:1.55;
  margin-top:auto; padding-top:12px;
  border-top:1px solid var(--border);
}

/* ── Score bar (for quality cards) ─────────────────────────── */
.rw-score-bar-track {
  height:4px; border-radius:999px; background:var(--border);
  overflow:hidden; margin-bottom:10px;
}
.rw-score-bar-fill {
  height:100%; border-radius:999px;
  transition:width 900ms cubic-bezier(0.16,1,0.3,1);
}

/* ── Empty state ───────────────────────────────────────────── */
.rw-empty {
  display:flex; flex-direction:column; align-items:center;
  justify-content:center; padding:48px 24px;
  text-align:center;
  border:1px dashed var(--border); border-radius:16px;
  background:var(--bg-elevated);
  animation:rwFadeIn 300ms ease both;
}
.rw-empty-icon { font-size:32px; margin-bottom:12px; opacity:0.4; }
.rw-empty-title { font-size:14px; font-weight:700; color:var(--fg-default); margin-bottom:4px; }
.rw-empty-sub { font-size:12px; color:var(--fg-muted); line-height:1.6; }

/* ── Skeleton loader ───────────────────────────────────────── */
.rw-skeleton-grid { display:grid; gap:14px; }
.rw-skeleton-card {
  border-radius:18px; border:1px solid var(--border);
  background:var(--bg-elevated); padding:22px 24px; min-height:200px;
  animation:rwFadeIn 300ms ease both;
}
.rw-skeleton-line {
  border-radius:6px;
  background:linear-gradient(90deg, var(--bg-subtle) 25%, var(--border) 50%, var(--bg-subtle) 75%);
  background-size:200% 100%;
  animation:rwShimmer 1.6s infinite;
}

/* ── Rank indicator ────────────────────────────────────────── */
.rw-rank {
  position:absolute; top:18px; right:20px;
  font-size:11px; font-weight:800; letter-spacing:0.04em;
  color:var(--fg-muted); opacity:0.5;
}

/* ── Team chip ─────────────────────────────────────────────── */
.rw-team-chip {
  display:inline-flex; align-items:center; gap:3px;
  height:18px; padding:0 7px; border-radius:4px;
  font-size:9px; font-weight:700; letter-spacing:0.07em;
  text-transform:uppercase; flex-shrink:0;
}

/* ── Responsive ────────────────────────────────────────────── */
@media(max-width:640px) {
  .rw-grid { grid-template-columns:1fr !important; }
  .rw-value { font-size:36px; }
  .rw-card { padding:18px 18px 16px; }
  .rw-card-watermark { font-size:80px; }
}
`;

function injectRWStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(RW_CSS_ID)) return;
  const el = document.createElement("style");
  el.id = RW_CSS_ID;
  el.textContent = RW_CSS;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function normalizeAgentId(value?: string | null) {
  return String(value ?? "").trim().replace(/\.0+$/, "");
}

function normalizeAgentName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const MIN_QUALITY_AUDITS = 5;

function normalizeTeamName(value?: string | null): TeamName | null {
  const team = String(value ?? "").trim().toLowerCase();
  if (["call", "calls", "call team", "calls team"].includes(team)) return "Calls";
  if (["ticket", "tickets", "ticket team", "tickets team"].includes(team)) return "Tickets";
  if (["sale", "sales", "sale team", "sales team"].includes(team)) return "Sales";
  return null;
}

function getAgentIdentityKey(agentId?: string | null, agentName?: string | null): string {
  const id = normalizeAgentId(agentId);
  if (id) return `id:${id}`;
  return `name:${normalizeAgentName(agentName)}`;
}

function isFiniteScore(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

function getCurrentMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  return { start, end };
}

function matchesRange(startDate?: string | null, endDate?: string | null) {
  const { start, end } = getCurrentMonthBounds();
  const recordStart = String(startDate ?? "").slice(0, 10);
  const recordEnd = String(endDate ?? startDate ?? "").slice(0, 10);
  if (!recordStart) return false;
  return recordEnd >= start && recordStart <= end;
}

function getCurrentMonthLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Parse "Name - ID" subtitle back into parts for nicer display
function parseSubtitle(subtitle: string): { name: string; id: string } {
  const parts = subtitle.split(" - ");
  if (parts.length >= 2) {
    return { name: parts[0].trim(), id: parts.slice(1).join(" - ").trim() };
  }
  return { name: subtitle, id: "" };
}

// Per-kind config: emoji, color, badge style
type KindConfig = {
  emoji: string;
  color: string;
  badgeBg: string;
  badgeColor: string;
  glowColor: string;
};

function getKindConfig(kind: RecognitionKind, team?: TeamName | null): KindConfig {
  if (kind === "quality") {
    return {
      emoji: "🏆",
      color: "var(--accent-amber)",
      badgeBg: "color-mix(in srgb,var(--accent-amber) 14%,transparent)",
      badgeColor: "var(--accent-amber)",
      glowColor: "var(--accent-amber)",
    };
  }
  if (kind === "released") {
    return {
      emoji: "📋",
      color: "var(--accent-emerald)",
      badgeBg: "color-mix(in srgb,var(--accent-emerald) 14%,transparent)",
      badgeColor: "var(--accent-emerald)",
      glowColor: "var(--accent-emerald)",
    };
  }
  // volume — color by team
  const teamColors: Record<string, KindConfig> = {
    Calls: {
      emoji: "📞",
      color: "var(--accent-blue)",
      badgeBg: "color-mix(in srgb,var(--accent-blue) 14%,transparent)",
      badgeColor: "var(--accent-blue)",
      glowColor: "var(--accent-blue)",
    },
    Tickets: {
      emoji: "🎫",
      color: "var(--accent-violet)",
      badgeBg: "color-mix(in srgb,var(--accent-violet) 14%,transparent)",
      badgeColor: "var(--accent-violet)",
      glowColor: "var(--accent-violet)",
    },
    Sales: {
      emoji: "💰",
      color: "var(--accent-emerald)",
      badgeBg: "color-mix(in srgb,var(--accent-emerald) 14%,transparent)",
      badgeColor: "var(--accent-emerald)",
      glowColor: "var(--accent-emerald)",
    },
  };
  return (
    teamColors[team ?? ""] ?? {
      emoji: "⭐",
      color: "var(--accent-cyan)",
      badgeBg: "color-mix(in srgb,var(--accent-cyan) 14%,transparent)",
      badgeColor: "var(--accent-cyan)",
      glowColor: "var(--accent-cyan)",
    }
  );
}

function getTeamChipStyle(team?: string | null): CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    Calls:   { bg: "color-mix(in srgb,var(--accent-blue) 12%,transparent)",    color: "var(--accent-blue)" },
    Tickets: { bg: "color-mix(in srgb,var(--accent-violet) 12%,transparent)",  color: "var(--accent-violet)" },
    Sales:   { bg: "color-mix(in srgb,var(--accent-emerald) 12%,transparent)", color: "var(--accent-emerald)" },
  };
  const style = map[team ?? ""] ?? { bg: "var(--bg-subtle)", color: "var(--fg-muted)" };
  return { background: style.bg, color: style.color };
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

const Skeleton = memo(function Skeleton({ compact }: { compact: boolean }) {
  const count = compact ? 3 : 5;
  const cols = compact ? 3 : 3;
  return (
    <div
      className="rw-skeleton-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rw-skeleton-card" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="rw-skeleton-line" style={{ height: 20, width: "40%", marginBottom: 14, borderRadius: 5 }} />
          <div className="rw-skeleton-line" style={{ height: 12, width: "60%", marginBottom: 16 }} />
          <div className="rw-skeleton-line" style={{ height: 48, width: "55%", marginBottom: 12, borderRadius: 8 }} />
          <div className="rw-skeleton-line" style={{ height: 14, width: "80%", marginBottom: 6 }} />
          <div className="rw-skeleton-line" style={{ height: 12, width: "55%" }} />
        </div>
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Recognition Card
// ─────────────────────────────────────────────────────────────

const RecognitionCard = memo(function RecognitionCard({
  entry,
  index,
  showTeam,
}: {
  entry: RecognitionEntry;
  index: number;
  showTeam: boolean;
}) {
  const cfg = getKindConfig(entry.kind, entry.team as TeamName | null);
  const { name, id } = parseSubtitle(entry.subtitle);
  const delay = index * 60;

  // For quality cards: extract numeric score for the progress bar
  const isQuality = entry.kind === "quality";
  const numericScore = isQuality
    ? parseFloat(entry.value.replace("%", ""))
    : null;

  return (
    <div
      className={`rw-card rw-card--${entry.kind}`}
      style={
        {
          "--card-delay": `${delay}ms`,
          animationDelay: `${delay}ms`,
        } as CSSProperties
      }
    >
      {/* Top accent glow */}
      <div
        className="rw-card-glow"
        style={{ background: cfg.glowColor }}
      />

      {/* Background watermark */}
      <div className="rw-card-watermark">{cfg.emoji}</div>

      {/* Rank */}
      <div className="rw-rank">#{index + 1}</div>

      {/* Badge */}
      <div
        className="rw-badge"
        style={{
          background: cfg.badgeBg,
          color: cfg.badgeColor,
          border: `1px solid color-mix(in srgb,${cfg.color} 20%,transparent)`,
        }}
      >
        {cfg.emoji} {entry.badge}
      </div>

      {/* Card title */}
      <div className="rw-card-title">{entry.title}</div>

      {/* Big value */}
      <div className="rw-value" style={{ color: cfg.color }}>
        {entry.value}
      </div>

      {/* Score bar for quality */}
      {isQuality && numericScore !== null && (
        <div className="rw-score-bar-track">
          <div
            className="rw-score-bar-fill"
            style={{
              width: `${Math.min(numericScore, 100)}%`,
              background: cfg.color,
            }}
          />
        </div>
      )}

      {isQuality && entry.sampleSize !== undefined && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--fg-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          {entry.sampleSize} qualifying audits
        </div>
      )}

      {/* Agent */}
      <div className="rw-agent">
        {/* Avatar chip */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: cfg.badgeBg,
            color: cfg.color,
            fontSize: 10,
            fontWeight: 800,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            border: `1px solid color-mix(in srgb,${cfg.color} 20%,transparent)`,
          }}
        >
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        {showTeam && entry.team && (
          <span
            className="rw-team-chip"
            style={getTeamChipStyle(entry.team)}
          >
            {entry.team}
          </span>
        )}
      </div>

      {/* Agent ID */}
      {id && (
        <div className="rw-agent-id" style={{ marginBottom: 8 }}>
          ID: {id}
        </div>
      )}

      {/* Helper */}
      <div className="rw-helper">{entry.helper}</div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

function RecognitionWall({
  title = "Recognition Wall",
  compact = false,
  currentUser = null,
}: RecognitionWallProps) {
  useEffect(() => { injectRWStyles(); }, []);

  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [callsRecords, setCallsRecords] = useState<CallsRecord[]>([]);
  const [ticketsRecords, setTicketsRecords] = useState<TicketsRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadRecognitionData();
  }, []);

  async function loadRecognitionData() {
    setLoading(true);
    setError(null);
    try {
      const [
        auditsResult,
        profilesResult,
        callsResult,
        ticketsResult,
        salesResult,
      ] = await Promise.all([
        supabase
          .from("audits")
          .select("id, agent_id, agent_name, team, audit_date, quality_score, shared_with_agent"),
        supabase
          .from("profiles")
          .select("agent_id, agent_name, display_name, team")
          .eq("role", "agent"),
        supabase
          .from("calls_records")
          .select("agent_id, agent_name, calls_count, call_date, date_to"),
        supabase
          .from("tickets_records")
          .select("agent_id, agent_name, tickets_count, ticket_date, date_to"),
        supabase
          .from("sales_records")
          .select("agent_id, agent_name, amount, sale_date, date_to"),
      ]);

      if (auditsResult.error)  throw new Error(auditsResult.error.message);
      if (profilesResult.error) throw new Error(profilesResult.error.message);

      setAudits((auditsResult.data as AuditItem[]) ?? []);
      setProfiles((profilesResult.data as AgentProfile[]) ?? []);
      setCallsRecords((callsResult.data as CallsRecord[]) ?? []);
      setTicketsRecords((ticketsResult.data as TicketsRecord[]) ?? []);
      setSalesRecords((salesResult.data as SalesRecord[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recognition data");
    } finally {
      setLoading(false);
    }
  }

  // ── Profile label resolution ─────────────────────────────────────────────

  function getAgentLabel(
    agentId?: string | null,
    agentName?: string | null,
    team?: string | null
  ): string {
    const normalizedId = normalizeAgentId(agentId);
    const normalizedName = normalizeAgentName(agentName);
    const normalizedTeam = normalizeTeamName(team);

    const matched = profiles.find((profile) => {
      const profileTeam = normalizeTeamName(profile.team);
      if (normalizedTeam && profileTeam && profileTeam !== normalizedTeam) return false;

      const profileId = normalizeAgentId(profile.agent_id);
      const profileName = normalizeAgentName(profile.agent_name || profile.display_name);
      return Boolean(
        (normalizedId && profileId && normalizedId === profileId) ||
        (normalizedName && profileName && normalizedName === profileName)
      );
    });

    const displayName = matched?.display_name || matched?.agent_name || agentName || "-";
    const id = normalizedId || normalizeAgentId(matched?.agent_id) || "-";
    // "Full Name - Agent ID" — parsed back out in RecognitionCard
    return `${displayName} - ${id}`;
  }

  // ── Leaders ───────────────────────────────────────────────────────────────

  function getQualityLeader(
    team: TeamName,
    scopedAudits: AuditItem[]
  ): { label: string; average: number; auditCount: number } | null {
    const grouped = new Map<string, { label: string; scores: number[]; auditCount: number }>();

    scopedAudits
      .filter((audit) => normalizeTeamName(audit.team) === team)
      .filter((audit) => isFiniteScore(audit.quality_score))
      .forEach((audit) => {
        const key = getAgentIdentityKey(audit.agent_id, audit.agent_name);
        const score = Number(audit.quality_score);
        const entry = grouped.get(key);

        if (entry) {
          entry.scores.push(score);
          entry.auditCount += 1;
        } else {
          grouped.set(key, {
            label: getAgentLabel(audit.agent_id, audit.agent_name, team),
            scores: [score],
            auditCount: 1,
          });
        }
      });

    const eligible = Array.from(grouped.values())
      .map((item) => ({
        label: item.label,
        auditCount: item.auditCount,
        average: item.scores.reduce((sum, value) => sum + value, 0) / item.scores.length,
      }))
      .filter((item) => item.auditCount >= MIN_QUALITY_AUDITS)
      .sort((a, b) => {
        if (b.average !== a.average) return b.average - a.average;
        return b.auditCount - a.auditCount;
      });

    return eligible[0] ?? null;
  }

  function getVolumeLeader(
    team: TeamName,
    records: (CallsRecord | TicketsRecord | SalesRecord)[]
  ): { label: string; total: number } | null {
    const grouped = new Map<string, { label: string; total: number }>();
    records.forEach((record) => {
      const key = getAgentIdentityKey(record.agent_id, record.agent_name);
      const amount =
        team === "Calls"
          ? Number((record as CallsRecord).calls_count ?? 0)
          : team === "Tickets"
          ? Number((record as TicketsRecord).tickets_count ?? 0)
          : Number((record as SalesRecord).amount ?? 0);
      const entry = grouped.get(key);
      if (entry) {
        entry.total += amount;
      } else {
        grouped.set(key, {
          label: getAgentLabel(record.agent_id, record.agent_name, team),
          total: amount,
        });
      }
    });

    const sorted = Array.from(grouped.values()).sort(
      (a, b) => b.total - a.total
    );
    return sorted[0] ?? null;
  }

  // ── Scoping ────────────────────────────────────────────────────────────────

  const teamScope: TeamName | null =
    currentUser?.role === "agent" || currentUser?.role === "supervisor"
      ? normalizeTeamName(currentUser.team)
      : null;

  const monthAudits = useMemo(
    () => audits.filter((a) => matchesRange(a.audit_date, a.audit_date)),
    [audits]
  );
  const monthCalls = useMemo(
    () => callsRecords.filter((r) => matchesRange(r.call_date, r.date_to)),
    [callsRecords]
  );
  const monthTickets = useMemo(
    () => ticketsRecords.filter((r) => matchesRange(r.ticket_date, r.date_to)),
    [ticketsRecords]
  );
  const monthSales = useMemo(
    () => salesRecords.filter((r) => matchesRange(r.sale_date, r.date_to)),
    [salesRecords]
  );

  const scopedAudits  = useMemo(() => monthAudits.filter((a)  => teamScope ? normalizeTeamName(a.team) === teamScope : true), [monthAudits,  teamScope]);
  const scopedCalls   = useMemo(() => teamScope && teamScope !== "Calls"   ? [] : monthCalls,   [monthCalls,   teamScope]);
  const scopedTickets = useMemo(() => teamScope && teamScope !== "Tickets" ? [] : monthTickets, [monthTickets, teamScope]);
  const scopedSales   = useMemo(() => teamScope && teamScope !== "Sales"   ? [] : monthSales,   [monthSales,   teamScope]);

  // ── Build entries ──────────────────────────────────────────────────────────

  const entries = useMemo<RecognitionEntry[]>(() => {
    const results: RecognitionEntry[] = [];

    if (teamScope) {
      // Scoped view: one team only
      const qualityLeader = getQualityLeader(teamScope, scopedAudits);
      if (qualityLeader) {
        results.push({
          title: `${teamScope} Quality Champion`,
          value: `${qualityLeader.average.toFixed(2)}%`,
          subtitle: qualityLeader.label,
          badge: "Quality",
          helper: `Highest average audit score this month · ${qualityLeader.auditCount} audits`,
          kind: "quality",
          team: teamScope,
          sampleSize: qualityLeader.auditCount,
        });
      }

      if (teamScope === "Calls") {
        const leader = getVolumeLeader("Calls", scopedCalls);
        if (leader) {
          results.push({
            title: "Calls Star",
            value: `${leader.total.toLocaleString()}`,
            subtitle: leader.label,
            badge: "Calls",
            helper: "Most calls handled this month",
            kind: "volume",
            team: "Calls",
          });
        }
      }
      if (teamScope === "Tickets") {
        const leader = getVolumeLeader("Tickets", scopedTickets);
        if (leader) {
          results.push({
            title: "Tickets Star",
            value: `${leader.total.toLocaleString()}`,
            subtitle: leader.label,
            badge: "Tickets",
            helper: "Most tickets resolved this month",
            kind: "volume",
            team: "Tickets",
          });
        }
      }
      if (teamScope === "Sales") {
        const leader = getVolumeLeader("Sales", scopedSales);
        if (leader) {
          results.push({
            title: "Sales Star",
            value: `$${leader.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            subtitle: leader.label,
            badge: "Sales",
            helper: "Highest sales amount this month",
            kind: "volume",
            team: "Sales",
          });
        }
      }
    } else {
      // Cross-team view
      const callsQuality = getQualityLeader("Calls", scopedAudits);
      if (callsQuality) {
        results.push({
          title: "Calls Quality Champion",
          value: `${callsQuality.average.toFixed(2)}%`,
          subtitle: callsQuality.label,
          badge: "Calls Quality",
          helper: `Highest average audit score this month · ${callsQuality.auditCount} audits`,
          kind: "quality",
          team: "Calls",
          sampleSize: callsQuality.auditCount,
        });
      }

      const ticketsQuality = getQualityLeader("Tickets", scopedAudits);
      if (ticketsQuality) {
        results.push({
          title: "Tickets Quality Champion",
          value: `${ticketsQuality.average.toFixed(2)}%`,
          subtitle: ticketsQuality.label,
          badge: "Tickets Quality",
          helper: `Highest average audit score this month · ${ticketsQuality.auditCount} audits`,
          kind: "quality",
          team: "Tickets",
          sampleSize: ticketsQuality.auditCount,
        });
      }

      const callsLeader = getVolumeLeader("Calls", scopedCalls);
      if (callsLeader) {
        results.push({
          title: "Calls Star",
          value: `${callsLeader.total.toLocaleString()}`,
          subtitle: callsLeader.label,
          badge: "Calls",
          helper: "Most calls handled this month",
          kind: "volume",
          team: "Calls",
        });
      }

      const ticketsLeader = getVolumeLeader("Tickets", scopedTickets);
      if (ticketsLeader) {
        results.push({
          title: "Tickets Star",
          value: `${ticketsLeader.total.toLocaleString()}`,
          subtitle: ticketsLeader.label,
          badge: "Tickets",
          helper: "Most tickets resolved this month",
          kind: "volume",
          team: "Tickets",
        });
      }

      const salesLeader = getVolumeLeader("Sales", scopedSales);
      if (salesLeader) {
        results.push({
          title: "Sales Star",
          value: `$${salesLeader.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          subtitle: salesLeader.label,
          badge: "Sales",
          helper: "Highest sales amount this month",
          kind: "volume",
          team: "Sales",
        });
      }
    }

    // Release Ready — always cross-team (skip in compact)
    if (!compact) {
      const releasedMap = new Map<
        string,
        { label: string; count: number; team: string }
      >();
      scopedAudits
        .filter((a) => Boolean(a.shared_with_agent))
        .forEach((a) => {
          const key = getAgentIdentityKey(a.agent_id, a.agent_name);
          const entry = releasedMap.get(key);
          if (entry) {
            entry.count += 1;
          } else {
            releasedMap.set(key, {
              label: getAgentLabel(a.agent_id, a.agent_name, a.team),
              count: 1,
              team: String(a.team ?? "-"),
            });
          }
        });

      const releasedLeader = Array.from(releasedMap.values()).sort(
        (a, b) => b.count - a.count
      )[0];
      if (releasedLeader) {
        results.push({
          title: "Release Ready",
          value: `${releasedLeader.count}`,
          subtitle: teamScope
            ? releasedLeader.label
            : `${releasedLeader.label} · ${releasedLeader.team}`,
          badge: "Released",
          helper: "Most audits shared with agent this month",
          kind: "released",
          team: releasedLeader.team as TeamName,
        });
      }
    }

    return compact ? results.slice(0, 3) : results;
  }, [compact, scopedAudits, scopedCalls, scopedTickets, scopedSales, teamScope, profiles]);

  // ── Grid columns ───────────────────────────────────────────────────────────
  const gridCols = useMemo(() => {
    const n = entries.length;
    if (compact) return "repeat(auto-fit, minmax(220px, 1fr))";
    if (n <= 2)  return `repeat(${n}, minmax(280px, 1fr))`;
    if (n === 3) return "repeat(3, 1fr)";
    if (n === 4) return "repeat(2, 1fr)";
    return "repeat(3, 1fr)";
  }, [compact, entries.length]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rw-root">
      {/* Eyebrow */}
      <div className="rw-eyebrow">
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-amber)", display: "inline-block" }} />
        Recognition
      </div>

      {/* Header */}
      <div className="rw-header">
        <div>
          <div className="rw-title">{title}</div>
          <div className="rw-subtitle">
            {teamScope
              ? `Celebrating top performers on the ${teamScope} team`
              : "Celebrating top performers across all teams"
            }
          </div>
        </div>
        <div className="rw-month-pill">
          <span style={{ fontSize: 12 }}>📅</span>
          {getCurrentMonthLabel()}
        </div>
      </div>

      {/* Loading */}
      {loading && <Skeleton compact={compact} />}

      {/* Error */}
      {!loading && error && (
        <div className="rw-empty">
          <div className="rw-empty-icon">⚠️</div>
          <div className="rw-empty-title">Couldn't load recognition data</div>
          <div className="rw-empty-sub">{error}</div>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <div className="rw-empty">
          <div className="rw-empty-icon">🏆</div>
          <div className="rw-empty-title">No leaders yet this month</div>
          <div className="rw-empty-sub">
            Recognition entries will appear once performance data is recorded for {getCurrentMonthLabel()}. Quality champions require at least {MIN_QUALITY_AUDITS} audits so one-off 100% scores do not win the wall.
          </div>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && entries.length > 0 && (
        <div className="rw-grid" style={{ gridTemplateColumns: gridCols }}>
          {entries.map((entry, i) => (
            <RecognitionCard
              key={`${entry.title}-${entry.subtitle}`}
              entry={entry}
              index={i}
              showTeam={!teamScope}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RecognitionWall;
