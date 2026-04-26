import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { pageVariants } from '../lib/animations';

interface PageTransitionProps {
  children: ReactNode;
  key?: string | number;
}

/**
 * PageTransition Component
 * Wraps page content with smooth fade and slide animations.
 * Use this to wrap main page components for consistent transitions.
 */
export function PageTransition({ children, key }: PageTransitionProps) {
  return (
    <motion.div
      key={key}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
