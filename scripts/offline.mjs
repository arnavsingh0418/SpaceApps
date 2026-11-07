import { readdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const dir = new URL("../dist/", import.meta.url),
  files = [];
async function walk(url, prefix = "") {
  for (const e of await readdir(url, { withFileTypes: true })) {
    if (e.isDirectory())
      await walk(new URL(e.name + "/", url), prefix + e.name + "/");
    else if (e.name !== "sw.js") files.push(prefix + e.name);
  }
}
await walk(dir);
const hash = createHash("sha256");
for (const f of files.sort()) hash.update(await readFile(new URL(f, dir)));
const version = hash.digest("hex").slice(0, 12);
await writeFile(
  new URL("sw.js", dir),
  `const CACHE='outpost-${version}';const FILES=${JSON.stringify(files.map((f) => "./" + f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('outpost-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));});
`,
);
console.log("Offline cache generated for " + files.length + " local files.");
