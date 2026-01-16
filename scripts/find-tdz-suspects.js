// scripts/find-tdz-suspects.js
import fs from 'fs';
import path from 'path';

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (p.includes('node_modules')) continue;
      walk(p);
    } else if (entry.isFile() && p.endsWith('.tsx')) {
      const src = fs.readFileSync(p, 'utf8');
      const memoMatches = [
        ...src.matchAll(
          /use(Memo|Effect|Callback)\s*\(\s*(?:async\s*)?\(?[^)]*\)?\s*=>\s*([\s\S]{0,800}?)\s*\)\s*(?:,|\))/g
        ),
      ];
      memoMatches.forEach((m) => {
        const body = m[2];
        const fnUsed = [...body.matchAll(/\b([a-zA-Z_$][a-zA-Z0-9_$]{2,})\s*\(/g)].map(
          (x) => x[1]
        );
        fnUsed.forEach((fn) => {
          const idx = src.indexOf(m[0]);
          const after = src.slice(idx + m[0].length);
          if (
            after.includes(`function ${fn}(`) ||
            after.includes(`const ${fn} =`) ||
            after.includes(`let ${fn} =`) ||
            after.includes(`var ${fn} =`)
          ) {
            console.log('Suspect TDZ:', p, 'used in memo before declaration ->', fn);
          }
        });
      });
    }
  }
}
walk('src');
