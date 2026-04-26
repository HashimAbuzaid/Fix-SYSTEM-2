import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { staggerItemVariants } from '../lib/animations';

interface ListItemProps {
  avatar?: ReactNode;
  title: string;
  subtitle?: string;
  status?: ReactNode;
  metadata?: ReactNode;
  onClick?: () => void;
  delay?: number;
}

/**
 * ListItem Component
 * Reusable list item with smooth animations and hover effects
 */
export function ListItem({
  avatar,
  title,
  subtitle,
  status,
  metadata,
  onClick,
  delay = 0,
}: ListItemProps) {
  return (
    <motion.div
      variants={staggerItemVariants}
      initial="initial"
      animate="animate"
      transition={{ delay }}
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={`rounded-lg border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-4 hover:border-blue-500/30 hover:bg-slate-800/60 transition-all duration-300 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {avatar && <div className="flex-shrink-0">{avatar}</div>}
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-100 truncate">{title}</p>
            {subtitle && (
              <p className="text-sm text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {status && <div>{status}</div>}
          {metadata && <div className="text-sm text-slate-400">{metadata}</div>}
        </div>
      </div>
    </motion.div>
  );
}

export default ListItem;
