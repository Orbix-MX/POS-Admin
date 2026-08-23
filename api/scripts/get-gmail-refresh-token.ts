/**
 * Obtiene el refresh token de Gmail para el envío de correos del servidor.
 *
 *   pnpm exec tsx scripts/get-gmail-refresh-token.ts
 *
 * Levanta un servidor local, abre el consentimiento de Google y canjea el
 * código por un refresh token. Lo imprime UNA vez: cópialo a `api/.env` como
 * `GMAIL_REFRESH_TOKEN` y no lo compartas — con él se puede enviar correo en
 * nombre de esa cuenta hasta que lo revoques desde
 * https://myaccount.google.com/permissions
 *
 * Antes de ejecutarlo, en Google Cloud Console → Credenciales → tu cliente
 * OAuth, añade esta URL a "URIs de redireccionamiento autorizados":
 *
 *   http://localhost:53682/oauth2callback
 *
 * y en "Pantalla de consentimiento" añade el scope
 * `https://www.googleapis.com/auth/gmail.send`.
 */
import 'dotenv/config';
import * as http from 'http';
import { randomBytes } from 'crypto';

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
// Solo enviar. El scope `https://mail.google.com/` daría además lectura y
// borrado de todo el buzón, que no hace falta para esto.
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en api/.env');
  process.exit(1);
}

// `state` para que solo se acepte la respuesta de la petición que iniciamos.
const state = randomBytes(16).toString('hex');

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    // `offline` + `consent` fuerzan que Google devuelva refresh token; sin
    // `prompt=consent` no lo reenvía si ya autorizaste antes.
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString();

async function exchangeCode(code: string): Promise<Record<string, string>> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await response.json()) as Record<string, string>;
  if (!response.ok) {
    throw new Error(`Google devolvió ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (url.pathname !== '/oauth2callback') {
    res.writeHead(404).end();
    return;
  }

  const error = url.searchParams.get('error');
  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Autorización cancelada: ${error}`);
    console.error(`\nAutorización cancelada: ${error}`);
    server.close();
    process.exit(1);
  }

  if (url.searchParams.get('state') !== state) {
    res.writeHead(400).end('state inválido');
    console.error('\nLa respuesta no corresponde a esta petición (state inválido).');
    server.close();
    process.exit(1);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('falta code');
    return;
  }

  exchangeCode(code)
    .then((tokens) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<h2>Listo</h2><p>Ya puedes cerrar esta pestaña y volver a la terminal.</p>',
      );

      if (!tokens.refresh_token) {
        console.error(
          '\nGoogle no devolvió refresh_token. Suele pasar si ya habías autorizado:' +
            '\nrevoca el acceso en https://myaccount.google.com/permissions y repite.',
        );
        process.exit(1);
      }

      console.log('\n─────────────────────────────────────────────');
      console.log('Añade esto a api/.env (y NO lo compartas):\n');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\nY completa con la cuenta que autorizaste:');
      console.log('GMAIL_SENDER=tu-correo@gmail.com');
      console.log('GMAIL_SENDER_NAME=Orbix ERP');
      console.log('─────────────────────────────────────────────\n');
    })
    .catch((err: Error) => {
      res.writeHead(500).end('Error al canjear el código');
      console.error(`\n${err.message}`);
      process.exit(1);
    })
    .finally(() => server.close());
});

server.listen(PORT, () => {
  console.log('\nAbre esta URL en el navegador y autoriza con la cuenta que enviará los correos:\n');
  console.log(authUrl);
  console.log(`\nEsperando la respuesta en ${REDIRECT_URI} …\n`);
});
