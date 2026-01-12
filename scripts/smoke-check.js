#!/usr/bin/env node

const domain = process.env.FINANZAS_CLOUDFRONT_DOMAIN;
if (!domain) {
  console.error('FINANZAS_CLOUDFRONT_DOMAIN is required.');
  process.exit(2);
}

(async () => {
  try {
    const res = await fetch(`https://${domain}/finanzas/index.html`);
    const text = await res.text();
    if (!/VITE_BUILD_SHA/.test(text)) {
      console.error('VITE_BUILD_SHA not found in index.html');
      console.log(text.slice(0, 1000));
      process.exit(3);
    }
    const m = text.match(/VITE_BUILD_SHA[:=]"?([0-9a-f]{7,40})"?/);
    console.log('Build SHA found:', m ? m[1] : 'unknown');
    console.log('Smoke check: passed');
  } catch (err) {
    console.error('Smoke-check failed', err);
    process.exit(4);
  }
})();
