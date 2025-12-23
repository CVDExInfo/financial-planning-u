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

export const logInfo = (
  ...args: Parameters<typeof console.log>
) => {
  if (process.env.NODE_ENV === "test") {
    // Silent in tests
    return;
  }

  console.log(...args);
};

export const logDebug = (
  message: string,
  context?: Record<string, unknown>
) => {
  if (process.env.NODE_ENV === "test") {
    // Silent in tests
    return;
  }

  if (context) {
    console.log(message, context);
  } else {
    console.log(message);
  }
};
