import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export const useAppToast = () => {
  const { toast } = useToast();

  return useMemo(() => ({
    success(title: string, description?: string) {
      toast({
        title,
        description,
        className: "border-primary/30 bg-background/95 backdrop-blur-md shadow-xl",
      });
    },
    info(title: string, description?: string) {
      toast({
        title,
        description,
        className: "border-border/80 bg-background/95 backdrop-blur-md shadow-xl",
      });
    },
    error(title: string, error: unknown, fallbackDescription = "Please try again.") {
      toast({
        title,
        description: getErrorMessage(error, fallbackDescription),
        variant: "destructive",
        className: "border-destructive/40 bg-destructive/90 text-destructive-foreground shadow-xl",
      });
    },
  }), [toast]);
};
