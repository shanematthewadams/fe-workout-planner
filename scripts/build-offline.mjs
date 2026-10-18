import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [
  "/",
  "/index.html",
  ...(await readdir("dist/assets")).filter(name => !name.endsWith(".woff")).map((name) => "/assets/" + name),
];
const core = files.filter(path => !path.endsWith(".woff2"));
const fonts = files.filter(path => path.endsWith(".woff2"));
const revision = createHash("sha256")
  .update(await readFile("dist/index.html"))
  .digest("hex")
  .slice(0, 16);
// Only bundled same-origin files are cached. Their immutable bytes do not vary by
// Origin; preview servers may emit Vary: Origin, which otherwise makes module
// requests miss entries precached without an Origin header. Never apply this to APIs.
const worker = `const CACHE=${JSON.stringify("fe-offline-" + revision)};const FILES=${JSON.stringify(files)};const CORE=${JSON.stringify(core)};const FONTS=${JSON.stringify(fonts)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.addAll(CORE);await Promise.allSettled(FONTS.map(file=>cache.add(file)));}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('fe-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='FE_OFFLINE_CHECK')event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(CORE.map(file=>cache.match(file,{ignoreVary:true})))).then(matches=>event.source?.postMessage({type:'FE_OFFLINE_STATUS',ready:matches.every(Boolean)})));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/.netlify/'))return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html',{ignoreVary:true}))));return;}
if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true}).then(saved=>saved||fetch(event.request))));});`;
await writeFile("dist/sw.js", worker);
