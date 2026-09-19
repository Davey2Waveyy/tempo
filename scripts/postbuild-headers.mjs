// vinext generates dist/client/_headers with an immutable rule for the
// content-hashed assets, but leaves the HTML shell and the service worker with
// no explicit cache policy — so browsers cache them heuristically and can keep
// serving an old build (which points at old assets) long after a deploy. Append
// no-store for the shell and sw.js so every load reflects the latest deploy.
// The hashed-asset immutable rule is more specific and still wins.
import { readFile, writeFile } from 'node:fs/promises';

const file = 'dist/client/_headers';
const rule = `
/
  Cache-Control: no-store
/index.html
  Cache-Control: no-store
/sw.js
  Cache-Control: no-store
`;
let current = '';
try {
  current = await readFile(file, 'utf8');
} catch {
  // No generated _headers (unexpected) — write ours anyway.
}
if (!current.includes('Cache-Control: no-store')) {
  await writeFile(file, current.trimEnd() + '\n' + rule.trimStart());
  console.log('postbuild: appended no-store headers for shell + sw.js');
} else {
  console.log('postbuild: no-store headers already present');
}
