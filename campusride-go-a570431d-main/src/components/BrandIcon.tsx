import { cn } from "@/lib/utils";

interface BrandIconProps {
  className?: string;
}

const BrandIcon = ({ className }: BrandIconProps) => {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl border border-primary/30 overflow-hidden",
        "bg-card/40",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 btn-primary-gradient opacity-90" />
      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2/3 h-1/3 rounded-full bg-primary-foreground/25 blur-sm" />
      <div className="relative w-1/3 h-1/3 rounded-sm rotate-45 border border-primary-foreground/80 bg-primary-foreground/20" />
      <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-foreground/90" />
    </div>
  );
};

export default BrandIcon;
