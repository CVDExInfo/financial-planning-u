import React from 'react';

export const BuildInfo: React.FC = () => {
  // Vite exposes env vars prefixed with VITE_ via import.meta.env
  const sha = import.meta.env.VITE_BUILD_SHA ?? '';
  const time = import.meta.env.VITE_BUILD_TIME ?? '';
  const branch = import.meta.env.VITE_BUILD_BRANCH ?? '';
  const deployEnv = import.meta.env.VITE_DEPLOY_ENV ?? '';

  // Show only on non-production or always if explicitly set
  if (!sha || sha.length < 7) return null;

  // Optionally hide in prod; show in staging/dev
  if (deployEnv === 'production') return null;

  // Validate date string
  let formattedTime = '';
  if (time) {
    const date = new Date(time);
    if (!isNaN(date.getTime())) {
      formattedTime = date.toUTCString();
    }
  }

  return (
    <div aria-hidden className="build-info text-xs text-muted flex items-center gap-4">
      <span>Build: <code>{sha.slice(0, 7)}</code></span>
      {branch && <span>Branch: {branch}</span>}
      {formattedTime && <span>Built: {formattedTime}</span>}
      <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-700">env: {deployEnv || 'staging'}</span>
    </div>
  );
};

export default BuildInfo;
