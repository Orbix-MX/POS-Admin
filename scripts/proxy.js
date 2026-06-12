/**
 * Proxy HTTP → HTTPS para desarrollo
 * Ejecutar: node scripts/proxy.js
 * Luego usar: http://10.0.2.2:3001/api en tu .env
 */

const http = require("http");
const https = require("https");
const url = require("url");

// Configuración
const PROXY_PORT = 3002;
const TARGET_HOST = "localhost";
const TARGET_PORT = 44350;
const TARGET_BASE_PATH = "/api";

const server = http.createServer((req, res) => {
  // Configurar CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url);
  const targetPath = TARGET_BASE_PATH + parsedUrl.path.replace("/api", "");

  console.log(`📡 ${req.method} ${targetPath}`);
  console.log(
    `🔑 Auth: ${req.headers.authorization ? "Bearer presente" : "Sin token"}`,
  );

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${TARGET_HOST}:${TARGET_PORT}`,
    },
    rejectUnauthorized: false, // Ignorar certificado SSL
  };

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`✅ ${proxyRes.statusCode} ${targetPath}`);

    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`❌ Error: ${err.message}`);
    res.writeHead(502);
    res.end(JSON.stringify({ error: err.message }));
  });

  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Proxy corriendo en http://0.0.0.0:${PROXY_PORT}`);
  console.log(
    `📍 Redirigiendo a https://${TARGET_HOST}:${TARGET_PORT}${TARGET_BASE_PATH}`,
  );
  console.log(`\n📱 En tu .env usa:`);
  console.log(`   EXPO_PUBLIC_API_URL=http://10.0.2.2:${PROXY_PORT}/api\n`);
});
