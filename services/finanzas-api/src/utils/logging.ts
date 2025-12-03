export const logError = (
  ...args: Parameters<typeof console.error>
) => {
  if (process.env.NODE_ENV === "test") {
    // In tests, downgrade to warning to avoid noisy console.error output while still surfacing context.
    console.warn(...args);
    return;
  }

  console.error(...args);
};
