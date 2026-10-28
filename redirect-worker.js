const TARGET_ORIGIN = "http://62.83.71.159:3006";

const SELF_DESTRUCT_SW = `
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (e) {}
      try {
        await self.registration.unregister();
      } catch (e) {}
      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clients) {
          try {
            const url = new URL(client.url);
            await client.navigate("${TARGET_ORIGIN}" + url.pathname + url.search + url.hash);
          } catch (e) {}
        }
      } catch (e) {}
    })()
  );
});
`.trim();

function buildRedirectHtml(targetUrl) {
  const escapedUrl = targetUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0; url=${escapedUrl}" />
  <title>Weiterleitung – TimeTracker</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 24px;
      text-align: center;
    }
    .card {
      max-width: 420px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 28px 24px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
    }
    h1 {
      font-size: 1.15rem;
      margin: 0 0 10px;
    }
    p {
      font-size: 0.92rem;
      color: #94a3b8;
      margin: 0 0 20px;
      line-height: 1.5;
    }
    a {
      display: inline-block;
      background: #3b82f6;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.92rem;
      padding: 10px 18px;
      border-radius: 10px;
    }
  </style>
  <script>
    (function () {
      var target = ${JSON.stringify(TARGET_ORIGIN)} + window.location.pathname + window.location.search + window.location.hash;
      try {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister(); }));
          }).catch(function () {});
        }
        if ("caches" in window) {
          caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          }).catch(function () {});
        }
      } catch (e) {}
      window.location.replace(target);
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>TimeTracker ist umgezogen</h1>
    <p>Du wirst automatisch zur neuen Adresse weitergeleitet…</p>
    <a href="${escapedUrl}">Jetzt öffnen (${escapedUrl})</a>
  </div>
</body>
</html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = `${TARGET_ORIGIN}${url.pathname}${url.search}`;

    // 1. Self-destruct any previously installed PWA Service Worker so cached clients get cleaned up
    if (url.pathname === "/sw.js") {
      return new Response(SELF_DESTRUCT_SW, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    const accept = request.headers.get("Accept") || "";
    const isRsc = request.headers.get("RSC") === "1";
    const isHtmlNavigation =
      accept.includes("text/html") ||
      request.headers.get("Sec-Fetch-Mode") === "navigate" ||
      request.headers.get("Sec-Fetch-Dest") === "document" ||
      isRsc;

    // 2. For browsers / PWA / Next.js RSC navigations: return 200 HTML with instant redirect + SW cleanup
    //    (avoids Mixed-Content errors when an existing HTTPS Service Worker intercepts the fetch to HTTP)
    if (isHtmlNavigation) {
      return new Response(buildRedirectHtml(targetUrl), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Location": targetUrl,
        },
      });
    }

    // 3. For all other requests (CLI, curl, direct API calls): standard HTTP 302 redirect
    return new Response(null, {
      status: 302,
      headers: {
        "Location": targetUrl,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  },
};
