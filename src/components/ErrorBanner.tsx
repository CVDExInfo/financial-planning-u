interface ErrorBannerProps {
  message?: string | null;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

export default ErrorBanner;
