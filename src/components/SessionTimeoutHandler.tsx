"use client";

import { useClerk, useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

export function SessionTimeoutHandler() {
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Tab close detection:
  // Since modern browsers block async fetches on tab close (beforeunload/unload),
  // we check sessionStorage on mount. sessionStorage is cleared automatically
  // when a tab is closed. If it is empty on mount while isSignedIn is true,
  // we know the user is returning from a closed tab and trigger a logout.
  useEffect(() => {
    if (!isSignedIn) {
      sessionStorage.setItem("sessionActive", "true");
      return;
    }

    const wasActive = sessionStorage.getItem("sessionActive");
    if (!wasActive) {
      signOut();
      return;
    }

    sessionStorage.setItem("sessionActive", "true");
  }, [isSignedIn, signOut]);

  // 2. Inactivity logout (10 minutes)
  useEffect(() => {
    if (!isSignedIn) return;

    const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes in ms

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(() => {
        signOut();
      }, INACTIVITY_LIMIT);
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    resetTimer();

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isSignedIn, signOut]);

  // 3. Best-effort unload logout
  useEffect(() => {
    if (!isSignedIn) return;

    const handleUnload = () => {
      sessionStorage.removeItem("sessionActive");
      signOut();
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [isSignedIn, signOut]);

  return null;
}
