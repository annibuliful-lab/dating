"use client";

import { getUserProfile } from "@/services/profile/get";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function NewUserRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id && !checked) {
      const checkNewUser = async () => {
        setChecked(true);
        try {
          const userId = session.user.id;
          if (!userId) return;

          // Check if user was created recently (within last 2 minutes)
          const twoMinutesAgo = new Date(
            Date.now() - 2 * 60 * 1000
          ).toISOString();

          const user = await getUserProfile(userId);
          if (user.createdAt && user.createdAt >= twoMinutesAgo) {
            // This is a new user, redirect to verification page
            router.push(`/signup/verify?userId=${session.user.id}`);
          }
        } catch (err) {
          console.error("Error checking new user:", err);
        }
      };

      checkNewUser();
    }
  }, [status, session, router, checked]);

  return null;
}
