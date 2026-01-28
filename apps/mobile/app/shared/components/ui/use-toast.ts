import { useCallback, useEffect, useState } from 'react';
import { ToastProps } from './toast';

interface ToastOptions {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
}

let toastStore: ToastProps[] = [];
const listeners = new Set<(toasts: ToastProps[]) => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(toastStore));
};

const addToast = (options: ToastOptions) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newToast: ToastProps = {
    id,
    ...options,
  };

  toastStore = [...toastStore, newToast];
  notifyListeners();

  if (options.duration !== 0) {
    setTimeout(() => {
      dismissToast(id);
    }, options.duration || 5000);
  }

  return id;
};

const dismissToast = (id: string) => {
  toastStore = toastStore.filter((toast) => toast.id !== id);
  notifyListeners();
};

const dismissAllToasts = () => {
  toastStore = [];
  notifyListeners();
};

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>(toastStore);

  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  const toast = useCallback((options: ToastOptions) => addToast(options), []);
  const dismiss = useCallback((id: string) => dismissToast(id), []);
  const dismissAll = useCallback(() => dismissAllToasts(), []);

  return {
    toasts,
    toast,
    dismiss,
    dismissAll,
  };
};

export default useToast; 