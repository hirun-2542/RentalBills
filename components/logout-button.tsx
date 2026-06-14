"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start"
      onClick={() => signOut({ redirectTo: "/login" })}
    >
      Logout
    </Button>
  );
}
