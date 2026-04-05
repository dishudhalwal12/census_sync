"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { signOut } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { firebaseAuth } from "@/lib/firebase/client";
import { clearActiveOfflineOwner } from "@/lib/offline/service";

export function LogoutButton({ ownerUid }: { ownerUid: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            if (firebaseAuth) {
              await signOut(firebaseAuth);
            }

            await clearActiveOfflineOwner();

            await fetch("/api/auth/logout", {
              method: "POST"
            });

            router.replace("/login");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Unable to sign out cleanly."
            );
          }
        })
      }
    >
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
