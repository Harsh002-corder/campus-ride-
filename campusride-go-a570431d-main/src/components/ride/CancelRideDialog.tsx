import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CancellationReason = {
  key: string;
  label: string;
};

type CancelRideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  reasonKey: string;
  customReason: string;
  reasons: CancellationReason[];
  onReasonKeyChange: (reasonKey: string) => void;
  onCustomReasonChange: (customReason: string) => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  confirmLabel?: string;
};

export default function CancelRideDialog({
  open,
  onOpenChange,
  title = "Cancel Ride",
  description = "Tell us why this ride is being cancelled.",
  reasonKey,
  customReason,
  reasons,
  onReasonKeyChange,
  onCustomReasonChange,
  onConfirm,
  busy = false,
  confirmLabel = "Confirm Cancellation",
}: CancelRideDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <select
            title="Cancellation reason"
            value={reasonKey}
            onChange={(event) => onReasonKeyChange(event.target.value)}
            className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm"
          >
            {reasons.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>

          {reasonKey === "other" && (
            <input
              value={customReason}
              onChange={(event) => onCustomReasonChange(event.target.value)}
              placeholder="Enter custom reason"
              className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm"
            />
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-muted/50 hover:bg-muted"
          >
            Keep Ride
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-destructive/20 text-destructive hover:bg-destructive/30 disabled:opacity-50"
          >
            {busy ? "Cancelling..." : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}