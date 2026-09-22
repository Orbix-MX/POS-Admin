---
name: dev-up
description: Actualiza orbix-admin desde origin/dev y, si el árbol quedó sano, arranca la API (:3001) y el Web (:5173). Úsala cuando el usuario pida "arranca el entorno", "levanta api y web", "haz pull y enciende", "dev up" o similar.
---

# dev-up

Pone el entorno de Orbix ERP al día y lo levanta. Dos fases: **sincronizar** y **arrancar**.
Si la fase de sincronizar falla, **no arranques nada** — reporta y espera instrucciones.

Aplica al repo `orbix-admin`: rama de trabajo `dev`, API + Web.

## Reglas duras

Estas no se negocian, ni siquiera si un paso parece que las pide:

- **Nunca commitear, ni de paso.** Ni siquiera cambios que "estorban" para el pull.
- **Nunca `git push`.** Esta skill solo lee de remoto.
- **Nunca `Co-Authored-By`** ni trailers de sesión/Claude en nada que escribas.
- **Nunca destruir trabajo local**: prohibido `git reset --hard`, `git checkout -- .`,
  `git clean`, `git stash drop`. Si el árbol sucio bloquea el pull, para y pregunta.
- **Nunca `pnpm exec prisma migrate dev`** aquí. En esta base pide resetear (drift conocido).
  Si llegaron migraciones nuevas, avisa al usuario y déjaselo a él.
- Cambiar de rama solo con permiso explícito del usuario en este turno.

## Fase 1 — Sincronizar

Trabaja siempre con `git -C C:/Repos/Orbix/orbix-admin`.

1. **Rama actual.** `git -C ... rev-parse --abbrev-ref HEAD`.
   Si no es `dev`: para, di en qué rama está y pregunta si cambia. No cambies solo.

2. **Árbol limpio.** `git -C ... status --porcelain`.
   Si hay cambios sin commitear: para, enseña la lista y pregunta qué hacer
   (commitear él, `stash` explícito, o abortar). No decidas tú.

3. **Fetch visible.** `git -C ... fetch origin` y luego `git -C ... status -sb`.
   Enseña el resultado antes de tocar nada — el usuario quiere ver el estado real
   antes de cualquier operación de red.

4. **Pull sin merge.** `git -C ... pull --ff-only origin dev`.
   `--ff-only` a propósito: si local y remoto divergieron, quieres que falle, no un
   merge commit sorpresa. Si falla, reporta la divergencia y para.

5. **Qué llegó.** Mira el diff del pull para decidir los pasos siguientes:
   `git -C ... diff --name-only HEAD@{1} HEAD`
   - `pnpm-lock.yaml` o cualquier `package.json` tocado → corre `pnpm install` en
     `orbix-admin/` antes de arrancar.
   - `api/prisma/migrations/**` o `api/prisma/schema.prisma` tocados → **no migres**.
     Avisa: "llegaron migraciones nuevas, la base local puede estar desfasada" y sigue.
     El usuario decide si aplica algo.
   - `.env.example` tocado → avisa por si falta una variable nueva en su `api/.env`.

## Fase 2 — Arrancar

6. **Puertos libres.** Comprueba 3001 (API) y 5173 (Web):
   ```powershell
   netstat -ano | Select-String ':3001 .*LISTENING'
   netstat -ano | Select-String ':5173 .*LISTENING'
   ```
   Si algo escucha ahí, es una instancia vieja. Enseña el PID y pregunta antes de matarla.

7. **Levanta los dos juntos**, en background, desde la raíz de `orbix-admin`:
   ```
   cd C:/Repos/Orbix/orbix-admin && pnpm dev
   ```
   Ese script es `turbo run dev --filter=@orbix/api --filter=@orbix/web`. Un solo proceso
   para ambos — no los lances por separado.

8. **Espera a que arranquen de verdad**, no asumas. Haz polling sobre el archivo de log
   del background task buscando las dos señales y los fallos:
   ```bash
   grep -qE "Nest application successfully started|error TS|EADDRINUSE|Cannot find module" "$LOG"
   ```
   La API tarda ~10s (seed de permisos y roles corre al arrancar, verás mucho
   `prisma:query` — es normal, no es un error).

9. **Verifica con HTTP**, no con el log. La suite de arranque no prueba DI ni guards:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/docs   # espera 200
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173            # espera 200
   ```

10. **Reporta**: rama y commits que entraron, si corriste `pnpm install`, si hay migraciones
    pendientes, las dos URLs con su código HTTP, y el id del background task por si hay que
    pararlo.

## Fallos que ya conocemos

- **La API muere sola sin error** → el sistema la mató por falta de memoria. Suele pasar con
  un daemon de Gradle vivo (`-Xmx2048m`) más Metro. Sugiere
  `C:\Repos\Orbix\orbix-admin\apps\mobile\orbix-mobile\android\gradlew.bat --stop` y reintenta.
- **Tests rojos en retail tenant-isolation** → preexistentes, no son regresión del pull.
- **La API arranca pero un endpoint da 500 por DI** → es de verdad; el log de arranque no
  siempre lo delata, por eso el paso 9 es curl y no "vi el log verde".
