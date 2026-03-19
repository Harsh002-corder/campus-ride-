
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Ripple effect hook
function useRipple(ref: React.RefObject<HTMLButtonElement>) {
  React.useEffect(() => {
    const button = ref.current;
    if (!button) return;
    const handleClick = (e: MouseEvent) => {
      const circle = document.createElement("span");
      const diameter = Math.max(button.clientWidth, button.clientHeight);
      const radius = diameter / 2;
      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - button.getBoundingClientRect().left - radius}px`;
      circle.style.top = `${e.clientY - button.getBoundingClientRect().top - radius}px`;
      circle.classList.add("ripple");
      button.appendChild(circle);
      setTimeout(() => {
        circle.remove();
      }, 600);
    };
    button.addEventListener("click", handleClick);
    return () => button.removeEventListener("click", handleClick);
  }, [ref]);
}

// Ripple effect styles
const rippleStyle = `
.ripple {
  position: absolute;
  border-radius: 50%;
  transform: scale(0);
  animation: ripple 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  background: radial-gradient(circle, rgba(0,212,255,0.35) 0%, rgba(9,9,121,0.18) 70%, rgba(2,0,36,0.10) 100%);
  pointer-events: none;
  z-index: 0;
  opacity: 1;
}
@keyframes ripple {
  to {
    transform: scale(3.5);
    opacity: 0;
  }
}
`;

const buttonVariants = cva(
  "relative overflow-hidden inline-flex flex-col items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}


const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    useRipple(buttonRef as React.RefObject<HTMLButtonElement>);
    const Comp = asChild ? Slot : "button";
    // Inject ripple style globally once
    React.useEffect(() => {
      if (!document.getElementById("ripple-style")) {
        const style = document.createElement("style");
        style.id = "ripple-style";
        style.innerHTML = rippleStyle;
        document.head.appendChild(style);
      }
    }, []);
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), "relative")}
        ref={(node) => {
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          buttonRef.current = node;
        }}
        style={{ overflow: "hidden", position: "relative" }}
        {...props}
      >
        {/* Ripple will be injected dynamically, but ensure content is above */}
        <span className="button-content-wrapper">
          {children}
        </span>
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
