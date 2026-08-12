import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
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

// Base para URLs absolutas (canonical, og:url, og:image) — es por-deployment
// (cada dominio de tenant define el suyo en su .env), nunca un dominio de
// cliente específico en el código. Sin PUBLIC_SITE_URL cae a localhost, útil
// solo para desarrollo.
const site = process.env.PUBLIC_SITE_URL || 'http://localhost:4321';

export default defineConfig({
  site,
  trailingSlash: 'never',
  // SSR solo para poder resolver el tenant por el Origin real de cada
  // request y renderizar la home con su contenido dinámico (ver
  // src/pages/index.astro). El resto de páginas siguen estáticas via
  // `export const prerender = true` en cada una — nada más cambia para ellas.
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
