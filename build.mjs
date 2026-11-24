// Builds dist/ : a self-contained, installable (Add to Home Screen) web app.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const src = readFileSync(new URL("./src/game.html", import.meta.url), "utf8");
const VERSION = Date.now().toString(36);
mkdirSync(new URL("./dist/", import.meta.url), { recursive: true });
const out = (f, s) => writeFileSync(new URL("./dist/" + f, import.meta.url), s);

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Mochi">
<meta name="theme-color" content="#BFE3DF">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-192.png">
</head>
<body>
`;
const sw = `<script>
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
</script>
</body>
</html>`;
out("index.html", head + src + "\n" + sw);

out("manifest.webmanifest", JSON.stringify({
  name: "Mochi the Cat", short_name: "Mochi", start_url: "./", scope: "./",
  display: "fullscreen", orientation: "any", background_color: "#BFE3DF", theme_color: "#BFE3DF",
  icons: [192, 512].map((s) => ({ src: `icon-${s}.png`, sizes: `${s}x${s}`, type: "image/png", purpose: "any" }))
}, null, 2));

out("sw.js", `const C = "mochi-${VERSION}";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(C).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
`);

// Icon: Mochi's face on the wall colour, rendered from the game's own SVG.
const svg = src.match(/<svg id="cat"[\s\S]*?<\/svg>/)[0]
  .replace('id="cat"', 'id="cat" width="100%" height="100%"')
  .replace('viewBox="0 0 400 520"', 'viewBox="40 30 320 320"')
  .replace('data-expr="closed"', 'data-expr="normal"').replace('class="sleeping"', "");
const browser = await chromium.launch();
for (const s of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: s, height: s } });
  await page.setContent(`<style>html,body{margin:0;background:#BFE3DF}#eyesHappy,#eyesClosed,#eyesDizzy,#mouthOpen{display:none}</style>${svg}`);
  writeFileSync(new URL(`./dist/icon-${s}.png`, import.meta.url), await page.screenshot());
  await page.close();
}
await browser.close();
console.log("built dist/ version", VERSION);
