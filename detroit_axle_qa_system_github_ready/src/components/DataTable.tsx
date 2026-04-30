import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => ReactNode;
  width?: string;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: ReactNode;
}

// Max height for the scrollable tbody container.
const TABLE_MAX_HEIGHT = 600; // px

/**
 * DataTable Component
 * Advanced table with sorting and filtering.
 *
 * This version intentionally avoids @tanstack/react-virtual because that
 * dependency is not installed in the current project build. Keeping the table
 * dependency-free fixes TS2307 and the related implicit-any errors while
 * preserving the public component API.
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  searchable = true,
  searchKeys = [],
  onRowClick,
  loading = false,
  emptyState,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const lower = search.toLowerCase();
    return data.filter((row: T) =>
      searchKeys.some((key: keyof T) =>
        String(row[key] ?? '').toLowerCase().includes(lower)
      )
    );
  }, [data, search, searchKeys]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a: T, b: T) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : 1;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortKey, sortOrder]);

  const handleSort = useCallback(
    (key: keyof T) => {
      if (sortKey === key) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortOrder('asc');
      }
    },
    [sortKey]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Search */}
      {searchable && searchKeys.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {/* Table wrapper */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Sticky header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <ColGroup columns={columns} />
            <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className="px-6 py-3 text-left font-semibold text-neutral-700 dark:text-neutral-300"
                  >
                    {column.sortable ? (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="flex items-center gap-2 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                      >
                        {column.label}
                        {sortKey === column.key && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                          >
                            {sortOrder === 'asc' ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </motion.div>
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overflow-x-auto" style={{ maxHeight: TABLE_MAX_HEIGHT }}>
          <table className="w-full text-sm table-fixed">
            <ColGroup columns={columns} />
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                      <span className="text-neutral-500 dark:text-neutral-400">
                        Loading...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 text-center">
                    {emptyState || (
                      <p className="text-neutral-500 dark:text-neutral-400">
                        No data found
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                sortedData.map((row: T) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.12 }}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((column) => (
                      <td key={String(column.key)} className="px-6 py-4">
                        {column.render
                          ? column.render(row[column.key], row)
                          : String(row[column.key] ?? '-')}
                      </td>
                    ))}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {!loading && sortedData.length > 0 && (
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            Showing {sortedData.length} of {data.length} results
          </span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * ColGroup renders a <colgroup> so both the header table and the body table
 * share identical column widths, keeping cells aligned.
 */
function ColGroup<T>({ columns }: { columns: Column<T>[] }) {
  return (
    <colgroup>
      {columns.map((col) => (
        <col
          key={String(col.key)}
          style={col.width ? { width: col.width } : undefined}
        />
      ))}
    </colgroup>
  );
}

export default DataTable;
