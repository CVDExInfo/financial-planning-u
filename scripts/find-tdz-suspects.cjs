// scripts/find-tdz-suspects.cjs
const fs = require('fs');
const path = require('path');

let found = false;

function scanFile(p) {
  const src = fs.readFileSync(p, 'utf8');
  const memoMatches = [...src.matchAll(/use(Memo|Effect|Callback)\s*\(\s*\(\)\s*=>\s*([\s\S]{0,700}?)\n\s*\)\s*,/g)];
  memoMatches.forEach(m => {
    const body = m[2];
    const fnUsed = [...body.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]{2,})\s*\(/g)].map(x=>x[1]);
    fnUsed.forEach(fn=>{
      const idx = src.indexOf(m[0]);
      const after = src.slice(idx + m[0].length);
      if(after.includes(`function ${fn}(`) || after.includes(`const ${fn} =`) || after.includes(`let ${fn} =`) || after.includes(`var ${fn} =`)){
        console.error(`TDZ candidate: ${p} uses ${fn} in a hook before its declaration`);
        found = true;
      }
    });
  });
}

function walk(dir) {
  for(const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if(entry.isDirectory()) {
      if(p.includes('node_modules')) continue;
      walk(p);
    } else if(entry.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx'))) {
      scanFile(p);
    }
  }
}

walk('src');

if(found) {
  console.error('TDZ scanner: at least one suspect was found. Failing the build as a hard gate.');
  process.exit(1);
} else {
  console.log('TDZ scanner: no suspects found.');
  process.exit(0);
}
