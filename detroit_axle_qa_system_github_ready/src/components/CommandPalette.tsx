import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  items: CommandItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Command Palette Component
 * Premium ⌘K interface inspired by Linear and Vercel
 */
export function CommandPalette({ items, open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(controlledOpen ?? false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const open = controlledOpen ?? isOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) {
      setIsOpen(value);
    }
    onOpenChange?.(value);
  };

  // Filter items based on search
  const filteredItems = search.trim() === ''
    ? items
    : items.filter((item) => {
        const searchLower = search.toLowerCase();
        return (
          item.label.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.category.toLowerCase().includes(searchLower) ||
          item.keywords?.some((kw) => kw.toLowerCase().includes(searchLower))
        );
      });

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with ⌘K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
        setSearch('');
        setSelectedIndex(0);
      }

      // Close with Escape
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }

      // Navigate with arrow keys
      if (open) {
        const totalItems = Object.values(groupedItems).flat().length;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        }

        // Execute with Enter
        if (e.key === 'Enter') {
          e.preventDefault();
          const allItems = Object.values(groupedItems).flat();
          if (allItems[selectedIndex]) {
            allItems[selectedIndex].action();
            setOpen(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, groupedItems, selectedIndex, setOpen]);

  const allItems = Object.values(groupedItems).flat();

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl"
          >
            <div className="mx-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
                <Search className="w-5 h-5 text-neutral-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search commands..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedIndex(0);
                  }}
                  className="flex-1 bg-transparent text-neutral-900 dark:text-neutral-50 placeholder-neutral-500 dark:placeholder-neutral-400 outline-none text-sm"
                />
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {allItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      No commands found.
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedItems).map(([category, categoryItems]) => (
                    <div key={category}>
                      <div className="px-4 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider bg-neutral-50 dark:bg-neutral-800/50">
                        {category}
                      </div>
                      {categoryItems.map((item, index) => {
                        const itemIndex = allItems.indexOf(item);
                        const isSelected = itemIndex === selectedIndex;

                        return (
                          <motion.button
                            key={item.id}
                            onClick={() => {
                              item.action();
                              setOpen(false);
                            }}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
                            className={`w-full px-4 py-3 flex items-center gap-3 text-left text-sm transition-colors ${
                              isSelected
                                ? 'bg-primary-50 dark:bg-primary-900/20'
                                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                            }`}
                          >
                            {item.icon && (
                              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                                {item.icon}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-neutral-900 dark:text-neutral-50 truncate">
                                {item.label}
                              </p>
                              {item.description && (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex-shrink-0 text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 px-2 py-1 rounded"
                              >
                                ⏎
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50">
                <span>Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-xs font-semibold">ESC</kbd> to close</span>
                <span>↑ ↓ to navigate • ⏎ to select</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default CommandPalette;
