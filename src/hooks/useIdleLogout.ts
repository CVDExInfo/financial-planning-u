import { useEffect, useRef } from "react";

import { useAuth } from "./useAuth";

const DEFAULT_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keypress",
  "touchstart",
  "scroll",
  "pointerdown",
];

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export function useIdleLogout(timeoutMs: number = FIFTEEN_MINUTES_MS) {
  const { logout } = useAuth();
  const timeoutRef = useRef<number | null>(null);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    const triggerLogout = () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      logout();
    };

    const resetTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(triggerLogout, timeoutMs);
    };

    DEFAULT_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, resetTimer, { passive: true })
    );

    resetTimer();

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      DEFAULT_EVENTS.forEach((eventName) =>
        window.removeEventListener(eventName, resetTimer)
      );
    };
  }, [logout, timeoutMs]);
}
