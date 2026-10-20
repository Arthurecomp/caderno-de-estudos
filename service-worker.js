/* ==========================================================================
   CADERNO DE ESTUDOS — service-worker.js
   Objetivo: deixar o app abrir offline. NÃO mexe no IndexedDB (os dados ficam
   no banco local do navegador, intocados).

   Estratégia:
   - Instalação: guarda em cache os arquivos do app (index, css, js, ícones).
   - Arquivos do próprio app: "rede primeiro, cache como reserva". Com internet
     você sempre recebe a versão mais nova; sem internet usa a copia guardada.
   - Bibliotecas do Anki (cdnjs): guardadas no cache na primeira vez que são
     baixadas, para continuarem disponíveis depois.
   - Para forçar a atualização do cache em todos os aparelhos, aumente CACHE_VERSION.
   ========================================================================== */

const CACHE_VERSION = "v1";
const APP_CACHE = "caderno-app-" + CACHE_VERSION;
const CDN_CACHE = "caderno-cdn-" + CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

const CDN_HOSTS = ["cdnjs.cloudflare.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes
          .filter((n) => (n.startsWith("caderno-app-") || n.startsWith("caderno-cdn-")) && n !== APP_CACHE && n !== CDN_CACHE)
          .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // arquivos do próprio app
  if (url.origin === self.location.origin) {
    event.respondWith(redePrimeiro(req, APP_CACHE, req.mode === "navigate"));
    return;
  }

  // bibliotecas do Anki
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(redePrimeiro(req, CDN_CACHE, false));
    return;
  }
  // qualquer outra origem: comportamento normal do navegador
});

async function redePrimeiro(req, nomeCache, ehNavegacao) {
  const cache = await caches.open(nomeCache);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) {
      // guarda uma copia (para navegação, guarda sob o index.html)
      cache.put(ehNavegacao ? "./index.html" : req, resp.clone());
    }
    return resp;
  } catch (err) {
    const guardado =
      (await cache.match(req, { ignoreSearch: true })) ||
      (ehNavegacao ? (await cache.match("./index.html")) || (await cache.match("./")) : null);
    if (guardado) return guardado;
    return new Response("Sem conexão e este arquivo ainda não está no cache.", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
