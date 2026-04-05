import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn, initialsFromName } from "@/lib/utils";

export function Avatar({
  name,
  className
}: {
  name: string;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-lavender-100 text-lavender-500",
        className
      )}
    >
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center text-xs font-semibold">
        {initialsFromName(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
