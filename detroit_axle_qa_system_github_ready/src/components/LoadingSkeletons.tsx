import { motion } from 'framer-motion';

/**
 * Skeleton loader for cards
 */
export function CardSkeleton() {
  return (
    <motion.div
      className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-6 space-y-4"
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="h-4 bg-slate-700/30 rounded w-3/4"></div>
      <div className="h-8 bg-slate-700/30 rounded w-1/2"></div>
      <div className="h-4 bg-slate-700/30 rounded w-full"></div>
    </motion.div>
  );
}

/**
 * Skeleton loader for list items
 */
export function ListItemSkeleton() {
  return (
    <motion.div
      className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-4 flex items-center gap-4"
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="w-10 h-10 bg-slate-700/30 rounded-full flex-shrink-0"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-700/30 rounded w-1/3"></div>
        <div className="h-3 bg-slate-700/30 rounded w-1/2"></div>
      </div>
      <div className="h-6 bg-slate-700/30 rounded w-16 flex-shrink-0"></div>
    </motion.div>
  );
}

/**
 * Skeleton loader for table rows
 */
export function TableRowSkeleton() {
  return (
    <motion.tr
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <td className="p-4"><div className="h-4 bg-slate-700/30 rounded w-3/4"></div></td>
      <td className="p-4"><div className="h-4 bg-slate-700/30 rounded w-1/2"></div></td>
      <td className="p-4"><div className="h-4 bg-slate-700/30 rounded w-2/3"></div></td>
      <td className="p-4"><div className="h-4 bg-slate-700/30 rounded w-1/3"></div></td>
    </motion.tr>
  );
}

/**
 * Skeleton loader for charts
 */
export function ChartSkeleton() {
  return (
    <motion.div
      className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-6"
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="h-6 bg-slate-700/30 rounded w-1/4 mb-4"></div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-8 bg-slate-700/30 rounded flex-1"></div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default CardSkeleton;
