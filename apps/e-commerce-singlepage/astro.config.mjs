import { defineConfig } from 'astro/config';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Astro's CLI evaluates this file before Vite injects .env into
// import.meta.env, so raw process.env.PUBLIC_SITE_URL isn't populated yet —
// read .env ourselves for this one build-time value.
const envPath = fileURLToPath(new URL('.env', import.meta.url));
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

// Base para URLs absolutas (canonical, og:url, og:image) — por-deployment,
// nunca un dominio de cliente específico en el código.
const site = process.env.PUBLIC_SITE_URL || 'http://localhost:4322';

export default defineConfig({
  site,
  trailingSlash: 'never',
  // 100% estático: todo el contenido del tenant (branding, secciones,
  // catálogo) se pide desde el navegador a la API pública (ver
  // public/js/tienda.js) — así este template se puede desplegar en
  // cualquier hosting estático (Cloudflare Pages, etc.) sin runtime Node.
  output: 'static',
});
