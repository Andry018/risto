import { useEffect, useId, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (required). */
  label: string;
  children: ReactNode;
  /** Overlay classes (alignment, padding, color, z-index). */
  overlayClassName?: string;
  /** Panel classes (background, size, rounding). */
  panelClassName?: string;
  /** Whether clicking the backdrop closes the dialog. Escape always closes. */
  closeOnOverlay?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Stack of currently open dialogs: only the top-most one handles Escape and traps Tab. */
const dialogStack: string[] = [];

export default function Dialog({
  open,
  onClose,
  label,
  children,
  overlayClassName = 'z-[100] items-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200',
  panelClassName = '',
  closeOnOverlay = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    dialogStack.push(id);

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (nodes.length === 0) return;
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault();
        lastNode.focus();
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const idx = dialogStack.lastIndexOf(id);
      if (idx !== -1) dialogStack.splice(idx, 1);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose, id]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 flex justify-center ${overlayClassName}`}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`outline-none ${panelClassName}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
