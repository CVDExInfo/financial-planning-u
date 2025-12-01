import { useEffect } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";

/**
 * Shows navigation warnings when there are unsaved changes.
 * - Prevents browser tab/window close without confirmation.
 * - Prompts on in-app route changes using React Router's blocker API.
 */
export function useUnsavedChangesPrompt(
  shouldBlock: boolean,
  message = "Tienes cambios sin guardar. ¿Deseas salir sin guardar?",
) {
  useBeforeUnload(
    (event) => {
      if (!shouldBlock) return;
      event.preventDefault();
      event.returnValue = message;
    },
    { capture: true },
  );

  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== "blocked") return;

    const confirmed = window.confirm(message);
    if (confirmed) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, message]);
}

export default useUnsavedChangesPrompt;
