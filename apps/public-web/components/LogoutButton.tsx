"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      type="button"
      className="nav-action"
      disabled={isPending}
      onClick={async () => {
        try {
          setIsPending(true);
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });
          router.refresh();
          router.push("/");
        } finally {
          setIsPending(false);
        }
      }}
    >
      {isPending ? "Signing out..." : "Sign Out"}
    </button>
  );
}
