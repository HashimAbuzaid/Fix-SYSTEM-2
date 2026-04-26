import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { fadeInUpVariants } from '../lib/animations';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
}

const colorClasses = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  purple: 'from-purple-500 to-purple-600',
  orange: 'from-orange-500 to-orange-600',
  red: 'from-red-500 to-red-600',
};

/**
 * StatCard Component
 * Displays a key metric with smooth animations and hover effects
 */
export function StatCard({
  title,
  value,
  change,
  icon,
  color = 'blue',
  trend = 'neutral',
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      variants={fadeInUpVariants}
      initial="initial"
      animate="animate"
      transition={{ delay }}
      whileHover={{ y: -4 }}
      className="rounded-lg border border-slate-700/50 bg-slate-800/40 backdrop-blur-sm p-6 hover:border-blue-500/30 hover:bg-slate-800/60 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-4">
        {icon && (
          <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} text-white`}>
            {icon}
          </div>
        )}
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            trend === 'up' ? 'text-green-400 bg-green-500/10' :
            trend === 'down' ? 'text-red-400 bg-red-500/10' :
            'text-slate-400 bg-slate-500/10'
          }`}>
            {change}
          </span>
        )}
      </div>
      
      <h3 className="text-sm font-medium text-slate-400 mb-1">{title}</h3>
      
      <motion.p
        className="text-2xl font-bold text-slate-100"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.1 }}
      >
        {value}
      </motion.p>
    </motion.div>
  );
}

export default StatCard;
