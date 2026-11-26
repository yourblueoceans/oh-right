import { useEffect } from 'react';

export interface ToastState {
  key: number;
  text: string;
  /** Shown for 10 seconds (spec screen 6). */
  onUndo?: () => void;
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 10_000);
    return () => clearTimeout(t);
  }, [toast.key, onClose]);

  return (
    <div className="toast" role="status" data-testid="toast">
      <span>{toast.text}</span>
      {toast.onUndo && (
        <button
          className="toast-undo"
          onClick={() => {
            toast.onUndo?.();
            onClose();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
