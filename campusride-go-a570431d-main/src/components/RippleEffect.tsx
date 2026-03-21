import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface RippleEffectProps {
  active: boolean;
  x: number;
  y: number;
  color: string;
  durationMs?: number;
  onComplete?: () => void;
}

const RippleEffect = ({
  active,
  x,
  y,
  color,
  durationMs = 700,
  onComplete,
}: RippleEffectProps) => {
  const [mounted, setMounted] = useState(false);
  const circleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;

    setMounted(true);

    const rafId = window.requestAnimationFrame(() => {
      const circle = circleRef.current;
      if (!circle) return;

      circle.style.left = `${x}px`;
      circle.style.top = `${y}px`;
      circle.style.backgroundColor = color;
      circle.style.transitionDuration = `${durationMs}ms`;
      circle.style.transform = "translate(-50%, -50%) scale(0)";

      window.requestAnimationFrame(() => {
        const target = circleRef.current;
        if (!target) return;
        target.style.transform = "translate(-50%, -50%) scale(60)";
      });
    });

    const timeoutId = window.setTimeout(() => {
      setMounted(false);
      onComplete?.();
    }, durationMs);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [active, color, durationMs, onComplete, x, y]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden" aria-hidden="true">
      <div
        ref={circleRef}
        className="theme-ripple-circle"
      />
    </div>,
    document.body,
  );
};

export default RippleEffect;
