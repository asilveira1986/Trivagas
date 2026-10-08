import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", {
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      success: "bg-primary/15 text-primary",
      warning: "bg-accent text-accent-foreground",
      danger: "bg-destructive/10 text-destructive",
      navy: "bg-secondary text-secondary-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
