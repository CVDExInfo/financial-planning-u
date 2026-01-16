import fs from 'fs';
import { SourceMapConsumer } from 'source-map';

const [, , jsPath, mapPath, symbol] = process.argv;
if (!jsPath || !mapPath || !symbol) {
  console.error('Usage: node map-minified-symbol.js <jsFile> <mapFile> <symbol>');
  process.exit(1);
}

const js = fs.readFileSync(jsPath, 'utf8');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

(async () => {
  const lines = js.split('\n');
  const occurrences = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(symbol)) {
      occurrences.push({ line: i + 1, text: lines[i] });
    }
  }
  console.log('Found occurrences:', occurrences.slice(0, 10));

  if (occurrences.length > 0) {
    const occ = occurrences[0];
    const charIndex = occ.text.indexOf(symbol);
    const column = charIndex;
    await SourceMapConsumer.with(map, null, (consumer) => {
      const pos = consumer.originalPositionFor({ line: occ.line, column });
      console.log('Mapped:', pos);
    });
  } else {
    console.log(
      'No occurrences found in JS file; consider searching for the minified symbol with boundary regex (\\b' +
        symbol +
        '\\b)'
    );
  }
})();
