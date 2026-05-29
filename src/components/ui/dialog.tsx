import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  setOpen: () => {},
});

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;

  // Stable reference prevents a new context value object on every render.
  // Without this, all consumers (DialogTrigger, DialogContent) re-render on
  // every parent render → cascade that manifests as "Invalid hook call" in
  // React 19's reconciler when the cascade reaches DnD hook consumers.
  const setOpen = React.useCallback(
    (v: boolean) => {
      setInternalOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );

  const ctx = React.useMemo(() => ({ open, setOpen }), [open, setOpen]);

  return (
    <DialogContext.Provider value={ctx}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactElement<{ onClick?: React.MouseEventHandler }> }) {
  const { setOpen } = React.useContext(DialogContext);
  if (asChild) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e);
        setOpen(true);
      },
    });
  }
  return <button onClick={() => setOpen(true)}>{children}</button>;
}

function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(DialogContext);
  if (!open) return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "rounded-lg border p-6 shadow-xl w-full",
          "bg-[var(--color-surface)] border-[var(--color-border)]",
          className
        )}
        style={{ maxWidth: "90vw" }}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </>,
    document.body
  );
}

function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col space-y-1.5 pb-4", className)}>{children}</div>;
}

function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      style={{ color: "var(--color-fg)" }}
    >
      {children}
    </h2>
  );
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle };
