import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

const typeConfig = {
  success: {
    icon: CheckCircle2,
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
  },
};

/**
 * Toast Component
 * Individual toast notification with auto-dismiss
 */
export function Toast({
  id,
  message,
  type,
  duration = 4000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: 0 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 20, x: 100 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} backdrop-blur-sm p-4 flex items-start gap-3 max-w-sm`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.textColor}`} />
      <p className="text-sm text-slate-200 flex-1">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="p-1 hover:bg-slate-800/50 rounded transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </motion.div>
  );
}

/**
 * ToastContainer Component
 * Manages multiple toasts
 */
interface ToastContainerProps {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={onClose}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook to manage toasts
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, type: ToastType = 'info', duration?: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const toastProps: ToastProps[] = toasts.map(toast => ({
    ...toast,
    onClose: removeToast,
  }));

  return {
    toasts: toastProps,
    addToast,
    removeToast,
    success: (msg: string, duration?: number) => addToast(msg, 'success', duration),
    error: (msg: string, duration?: number) => addToast(msg, 'error', duration),
    info: (msg: string, duration?: number) => addToast(msg, 'info', duration),
    warning: (msg: string, duration?: number) => addToast(msg, 'warning', duration),
  };
}

export default Toast;
