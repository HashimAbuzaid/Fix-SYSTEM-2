// ─────────────────────────────────────────────────────────────
// src/components/shell/CommandPalette.tsx
// ⌘K command palette with fuzzy search, recent pages, keyboard
// navigation, and per-group accent colours.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo, memo } from "react";
import { GROUP_ACCENT } from "../../config/routes";
import type { RoutePath } from "../../config/routes";
import type { NavItem } from "../../config/navItems";
import { NavIcon } from "./Sidebar";

// ── Types ─────────────────────────────────────────────────────

export interface RecentPage {
  path:      string;
  label:     string;
  group:     string;
  visitedAt: number;
}

export interface CommandPaletteProps {
  items:       readonly NavItem[];
  recentPages: RecentPage[];
  onNavigate:  (path: RoutePath) => void;
  onClose:     () => void;
}

// ── Icons ─────────────────────────────────────────────────────

const SearchIcon = memo(function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
});

// ── CommandPalette ────────────────────────────────────────────

export const CommandPalette = memo(function CommandPalette({
  items,
  recentPages,
  onNavigate,
  onClose,
}: CommandPaletteProps) {
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filtered results
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q),
    );
  }, [query, items]);

  // Reset selection when results change
  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelected((s) => Math.min(s + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelected((s) => Math.max(s - 1, 0));
          break;
        case "Enter":
          if (filtered[selected]) {
            onNavigate(filtered[selected].path);
            onClose();
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selected, onNavigate, onClose]);

  const showRecent = !query.trim() && recentPages.length > 0;

  return (
    <div
      className="da-cmd-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="da-cmd-palette" role="dialog" aria-label="Command palette" aria-modal="true">
        {/* Search input */}
        <div className="da-cmd-input-wrap">
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            className="da-cmd-input"
            placeholder="Search pages, navigate…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Command input"
            aria-autocomplete="list"
            aria-controls="da-cmd-results"
            role="combobox"
            aria-expanded="true"
          />
          <kbd
            style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "10px",
              background:    "var(--bg-subtle)",
              border:        "1px solid var(--border-strong)",
              borderRadius:  "4px",
              padding:       "2px 6px",
              color:         "var(--fg-muted)",
              flexShrink:    0,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          id="da-cmd-results"
          className="da-cmd-results"
          role="listbox"
          aria-label="Navigation options"
        >
          {/* Recent pages section */}
          {showRecent && (
            <>
              <div className="da-cmd-section-label">Recent</div>
              {recentPages.map((page) => {
                const accent = GROUP_ACCENT[page.group] ?? "var(--accent-blue)";
                return (
                  <div
                    key={page.path}
                    className="da-cmd-item"
                    role="option"
                    aria-selected="false"
                    onClick={() => {
                      onNavigate(page.path as RoutePath);
                      onClose();
                    }}
                  >
                    <div
                      className="da-cmd-item-icon"
                      style={{
                        background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                        color:      accent,
                      }}
                    >
                      <NavIcon label={page.label} size={13} />
                    </div>
                    <span className="da-cmd-item-label">{page.label}</span>
                    <span className="da-cmd-item-recent">recent</span>
                  </div>
                );
              })}
              <div className="da-cmd-section-label" style={{ marginTop: 4 }}>
                All Pages
              </div>
            </>
          )}

          {/* Main results */}
          {filtered.length === 0 ? (
            <div className="da-cmd-empty">No results for "{query}"</div>
          ) : (
            filtered.map((item, idx) => {
              const accent = GROUP_ACCENT[item.group] ?? "var(--accent-blue)";
              return (
                <div
                  key={item.path}
                  role="option"
                  aria-selected={idx === selected}
                  className={`da-cmd-item${idx === selected ? " selected" : ""}`}
                  onClick={() => {
                    onNavigate(item.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelected(idx)}
                  style={
                    { "--item-accent": accent } as React.CSSProperties
                  }
                >
                  <div
                    className="da-cmd-item-icon"
                    style={{
                      background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                      color:      accent,
                    }}
                  >
                    <NavIcon label={item.label} size={14} />
                  </div>
                  <span className="da-cmd-item-label">{item.label}</span>
                  <span className="da-cmd-item-group">{item.group}</span>
                  {item.shortcut && (
                    <span className="da-cmd-shortcut">{item.shortcut}</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="da-cmd-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> go</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: "auto" }}><kbd>?</kbd> shortcuts</span>
        </div>
      </div>
    </div>
  );
});

export default CommandPalette;
