import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  createHelpContent,
  deleteHelpContent,
  fetchAllHelpContent,
  hasHelpSystemBackend,
  updateHelpContent,
  type HelpContentRow,
  type HelpContentType,
} from "../lib/helpSystemApi";
import type { UserProfile } from "../context/AuthContext";

interface HelpContentAdminProps {
  readonly currentUser: UserProfile;
}

const CONTENT_TYPES: readonly HelpContentType[] = ["guide", "faq", "page", "support", "release_note", "tour"];
const ROLE_OPTIONS = ["all", "admin", "qa", "supervisor", "agent"] as const;

const cardStyle: CSSProperties = {
  borderRadius: "18px",
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  boxShadow: "var(--shadow-sm)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: "38px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-subtle)",
  color: "var(--fg-default)",
  padding: "0 12px",
  outline: "none",
  font: "inherit",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  height: "110px",
  padding: "10px 12px",
  resize: "vertical",
};

interface EditorState {
  readonly content_key: string;
  readonly content_type: HelpContentType;
  readonly title: string;
  readonly body: string;
  readonly roles: string;
  readonly sort_order: string;
  readonly active: boolean;
}

const emptyEditor: EditorState = {
  content_key: "",
  content_type: "guide",
  title: "",
  body: "",
  roles: "all",
  sort_order: "100",
  active: true,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function readBody(row: HelpContentRow): string {
  if (typeof row.content === "string") return row.content;
  if (typeof row.content !== "object" || row.content === null) return "";
  const record = row.content as Record<string, unknown>;
  const parts = ["description", "answer", "body", "text"]
    .map((key) => record[key])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  if (parts.length > 0) return parts[0];
  if (Array.isArray(record.tips)) return record.tips.filter((item): item is string => typeof item === "string").join("\n");
  if (Array.isArray(record.steps)) return record.steps.map((step) => JSON.stringify(step)).join("\n");
  return JSON.stringify(row.content, null, 2);
}

function contentFromBody(contentType: HelpContentType, body: string): Record<string, unknown> {
  if (contentType === "faq") return { answer: body };
  if (contentType === "guide") return { description: body };
  if (contentType === "page") {
    const [description = "", ...tips] = body.split("\n").map((line) => line.trim()).filter(Boolean);
    return { description, tips };
  }
  if (contentType === "release_note") return { description: body };
  if (contentType === "tour") {
    const steps = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ title: line, body: line }));
    return { steps };
  }
  return { body };
}

function rowToEditor(row: HelpContentRow): EditorState {
  return {
    content_key: row.content_key,
    content_type: row.content_type,
    title: row.title,
    body: readBody(row),
    roles: (row.roles || ["all"]).join(", "),
    sort_order: String(row.sort_order ?? 100),
    active: row.active !== false,
  };
}

function rolesFromCsv(value: string): readonly string[] {
  const roles = value
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
  return roles.length > 0 ? roles : ["all"];
}

const HelpContentAdmin = memo(function HelpContentAdmin({ currentUser }: HelpContentAdminProps) {
  const [rows, setRows] = useState<readonly HelpContentRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [filter, setFilter] = useState<HelpContentType | "all">("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const canUseBackend = hasHelpSystemBackend();

  const loadRows = useCallback(() => {
    if (!canUseBackend) {
      setLoading(false);
      setMessage("Supabase help-system tables are not configured yet. Run the included migration first.");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetchAllHelpContent(controller.signal)
      .then((nextRows) => {
        setRows(nextRows);
        setMessage("");
      })
      .catch((error: Error) => setMessage(error.message || "Could not load help content."))
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [canUseBackend]);

  useEffect(() => loadRows(), [loadRows]);

  const filteredRows = useMemo(
    () => rows.filter((row) => filter === "all" || row.content_type === filter),
    [filter, rows]
  );

  const updateEditor = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setEditor((current) => ({
      ...current,
      [key]: value,
      content_key:
        key === "title" && !editingId && !current.content_key
          ? slugify(String(value))
          : current.content_key,
    }));
  };

  const resetEditor = () => {
    setEditingId(null);
    setEditor(emptyEditor);
  };

  const saveContent = async () => {
    const contentKey = editor.content_key.trim() || slugify(editor.title);
    if (!contentKey || !editor.title.trim()) {
      setMessage("Content key and title are required.");
      return;
    }

    const payload = {
      content_key: contentKey,
      content_type: editor.content_type,
      title: editor.title.trim(),
      content: contentFromBody(editor.content_type, editor.body),
      roles: rolesFromCsv(editor.roles),
      sort_order: Number.parseInt(editor.sort_order, 10) || 100,
      active: editor.active,
    };

    try {
      if (editingId) {
        const updated = await updateHelpContent(editingId, payload);
        setRows((current) => current.map((row) => (row.id === editingId ? updated : row)));
        setMessage("Help content updated.");
      } else {
        const created = await createHelpContent(payload);
        setRows((current) => [created, ...current]);
        setMessage("Help content created.");
      }
      resetEditor();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save help content.");
    }
  };

  const removeContent = async (id: string) => {
    try {
      await deleteHelpContent(id);
      setRows((current) => current.filter((row) => row.id !== id));
      setMessage("Help content deleted.");
      if (editingId === id) resetEditor();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete help content.");
    }
  };

  if (currentUser.role !== "admin") {
    return (
      <div style={{ ...cardStyle, padding: "28px", maxWidth: "720px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", letterSpacing: "-0.03em" }}>Help Content Admin</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "13px", lineHeight: 1.55, marginTop: "10px" }}>
          This page is available to admins only.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) 1fr", gap: "18px", alignItems: "start" }}>
      <section style={{ ...cardStyle, padding: "18px", position: "sticky", top: "76px" }}>
        <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-violet)", marginBottom: "6px" }}>
          Admin CMS
        </div>
        <h1 style={{ margin: 0, fontSize: "24px", letterSpacing: "-0.04em", color: "var(--fg-default)" }}>
          Help Content
        </h1>
        <p style={{ margin: "8px 0 16px", color: "var(--fg-muted)", fontSize: "13px", lineHeight: 1.55 }}>
          Add and edit guides, FAQs, page help, release notes, and tour copy without redeploying.
        </p>

        <div style={{ display: "grid", gap: "12px" }}>
          <label style={labelStyle}>
            Type
            <select value={editor.content_type} onChange={(event) => updateEditor("content_type", event.target.value as HelpContentType)} style={inputStyle}>
              {CONTENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Title
            <input value={editor.title} onChange={(event) => updateEditor("title", event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Content key
            <input value={editor.content_key} onChange={(event) => updateEditor("content_key", event.target.value)} style={inputStyle} placeholder="how-scoring-works" />
          </label>
          <label style={labelStyle}>
            Body
            <textarea value={editor.body} onChange={(event) => updateEditor("body", event.target.value)} style={textareaStyle} placeholder="For page help, use first line as summary and following lines as tips." />
          </label>
          <label style={labelStyle}>
            Roles
            <input value={editor.roles} onChange={(event) => updateEditor("roles", event.target.value)} style={inputStyle} placeholder="all, admin, qa" />
            <span style={{ color: "var(--fg-muted)", fontSize: "11px", marginTop: "5px" }}>Allowed: {ROLE_OPTIONS.join(", ")}</span>
          </label>
          <label style={labelStyle}>
            Sort order
            <input value={editor.sort_order} onChange={(event) => updateEditor("sort_order", event.target.value)} style={inputStyle} inputMode="numeric" />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--fg-default)", fontSize: "13px", fontWeight: 700 }}>
            <input type="checkbox" checked={editor.active} onChange={(event) => updateEditor("active", event.target.checked)} /> Active
          </label>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={saveContent} style={primaryButtonStyle}>{editingId ? "Save changes" : "Create content"}</button>
            {editingId && <button type="button" onClick={resetEditor} style={secondaryButtonStyle}>Cancel</button>}
          </div>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
        <div style={{ ...cardStyle, padding: "14px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {(["all", ...CONTENT_TYPES] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              style={{
                height: "34px",
                padding: "0 12px",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                background: filter === type ? "color-mix(in srgb, var(--accent-violet) 14%, transparent)" : "var(--bg-subtle)",
                color: filter === type ? "var(--fg-default)" : "var(--fg-muted)",
                fontWeight: 700,
                fontSize: "12px",
              }}
            >
              {type}
            </button>
          ))}
          <button type="button" onClick={() => loadRows()} style={{ ...secondaryButtonStyle, marginLeft: "auto" }}>Refresh</button>
        </div>

        {message && <div role="status" style={{ ...cardStyle, padding: "12px 14px", color: "var(--fg-muted)", fontSize: "13px" }}>{message}</div>}

        {loading ? (
          <div style={{ ...cardStyle, padding: "28px", color: "var(--fg-muted)", fontSize: "13px" }}>Loading help content...</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ ...cardStyle, padding: "28px" }}>
            <h2 style={{ margin: 0, fontSize: "18px", color: "var(--fg-default)" }}>No content yet</h2>
            <p style={{ margin: "8px 0 0", color: "var(--fg-muted)", fontSize: "13px" }}>Create the first help article from the editor.</p>
          </div>
        ) : (
          filteredRows.map((row) => (
            <article key={row.id || row.content_key} style={{ ...cardStyle, padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "7px" }}>
                    <span style={{ color: "var(--accent-blue)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>{row.content_type}</span>
                    <span style={{ color: row.active === false ? "var(--accent-rose)" : "var(--accent-emerald)", fontSize: "11px", fontWeight: 700 }}>{row.active === false ? "Inactive" : "Active"}</span>
                    <span style={{ color: "var(--fg-muted)", fontSize: "11px" }}>{(row.roles || ["all"]).join(", ")}</span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: "17px", color: "var(--fg-default)", letterSpacing: "-0.02em" }}>{row.title}</h2>
                  <p style={{ margin: "8px 0 0", color: "var(--fg-muted)", fontSize: "13px", lineHeight: 1.55 }}>{readBody(row)}</p>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(row.id || null);
                      setEditor(rowToEditor(row));
                    }}
                    style={secondaryButtonStyle}
                  >
                    Edit
                  </button>
                  {row.id && <button type="button" onClick={() => removeContent(row.id as string)} style={dangerButtonStyle}>Delete</button>}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
});

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "var(--fg-default)",
  fontSize: "12px",
  fontWeight: 800,
};

const primaryButtonStyle: CSSProperties = {
  height: "38px",
  padding: "0 14px",
  borderRadius: "10px",
  border: "1px solid color-mix(in srgb, var(--accent-violet) 35%, transparent)",
  background: "color-mix(in srgb, var(--accent-violet) 16%, transparent)",
  color: "var(--fg-default)",
  fontWeight: 800,
};

const secondaryButtonStyle: CSSProperties = {
  height: "34px",
  padding: "0 12px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg-subtle)",
  color: "var(--fg-default)",
  fontWeight: 700,
};

const dangerButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  color: "var(--accent-rose)",
  border: "1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)",
};

export default HelpContentAdmin;
