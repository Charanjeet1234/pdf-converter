import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      id="toast-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const getIcon = () => {
            switch (toast.type) {
              case 'success':
                return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
              case 'error':
                return <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
              case 'warning':
                return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
              case 'info':
              default:
                return <Info className="w-5 h-5 text-indigo-600 shrink-0" />;
            }
          };

          const getBorderColor = () => {
            switch (toast.type) {
              case 'success':
                return 'border-emerald-200 bg-white text-emerald-950 shadow-emerald-900/5';
              case 'error':
                return 'border-rose-200 bg-white text-rose-950 shadow-rose-900/5';
              case 'warning':
                return 'border-amber-200 bg-white text-amber-950 shadow-amber-900/5';
              case 'info':
              default:
                return 'border-indigo-200 bg-white text-slate-900 shadow-indigo-900/5';
            }
          };

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg ${getBorderColor()}`}
            >
              {getIcon()}
              <div className="flex-1 text-sm">
                <div className="font-semibold">{toast.title}</div>
                {toast.description && (
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {toast.description}
                  </div>
                )}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
