---
name: commit
description: Prepara y crea un commit en orbix-admin, sin atribución de IA (nada de Co-Authored-By). Enseña archivos y mensaje y espera el visto bueno antes de commitear. No hace push. Úsala cuando el usuario pida "commitea", "haz commit", "guarda esto en git".
---

# commit

Crea **un** commit en **un** repo. No hace push (para eso está `commit-push`).

El repo es `orbix-admin`: rama `main`, trabajo en `dev`, sin hooks de git.

`brain/` vive dentro del repo — sus cambios son commits de `orbix-admin`, no de otro repo.

## Reglas duras

- **Nunca `Co-Authored-By`**, `Claude-Session:`, `Generated with Claude`, `noreply@anthropic.com`
  ni ningún trailer de sesión o de agente. Ni en el cuerpo, ni en el pie, ni en el título.
  Este repo no tiene hook que lo rechace — la disciplina la pones tú.
- **Nunca commitear sin el sí explícito del usuario en este turno.** Enseñas archivos y
  mensaje, y esperas. "Parece obvio" no es aprobación.
- **Nunca metas de paso lo que no se pidió.** Si el árbol trae cambios ajenos a la tarea,
  enséñalos aparte y pregunta; no los arrastres al `git add`.
- **Nunca `--no-verify`** ni `--no-gpg-sign`. Si un hook falla, arregla la causa.
- **Nunca `--amend`** sobre un commit existente. Commit nuevo.
- **Nunca `git push`** aquí, ni siquiera si el commit sale perfecto.
- En `main`/`master` para y pregunta antes de commitear.

## Pasos

1. **Alcance.** Un commit, un propósito. Si el árbol trae cambios de dos trabajos
   distintos, **no los mezcles**: di cuáles son y pregunta con cuál empiezas.

2. **Estado real.**
   ```bash
   git -C <repo> status --porcelain
   git -C <repo> rev-parse --abbrev-ref HEAD
   ```
   Si la rama es `main`/`master`, para y pregunta.

3. **Lee el diff antes de describirlo.** `git -C <repo> diff` y `git -C <repo> diff --staged`.
   El mensaje sale de lo que el diff hace, no de lo que tú creías estar haciendo.

4. **Redacta el mensaje.** Conventional Commits, en español, minúscula tras el scope:

   ```
   fix(products): la promoción respeta la existencia capturada
   ```

   El estilo de la casa describe **el efecto**, no la mecánica — mira `git log --oneline -10`
   del repo antes de escribir. Cuerpo solo si el porqué no cabe en el título.

5. **Enseña y espera.** Lista de archivos a incluir + mensaje completo, tal cual va a quedar.
   Para aquí. El usuario dice que sí, o corrige.

6. **Stage y commit.** Rutas explícitas, nunca `git add -A` a ciegas:
   ```bash
   git -C <repo> add <ruta> <ruta>
   git -C <repo> commit -F - <<'MSG'
   fix(products): la promoción respeta la existencia capturada
   MSG
   ```
   El heredoc `-F -` evita pelearse con el escapado de comillas en multilínea.

7. **Verifica que salió limpio** — no confíes en que lo escribiste bien:
   ```bash
   git -C <repo> log -1 --format='%s%n%n%b%n---%nTrailers: %(trailers)'
   ```
   Si aparece cualquier atribución de IA, es un error tuyo: dilo y arréglalo con
   `git -C <repo> commit --amend -F -` (única excepción a la regla de amend — es tu propio
   commit, recién hecho, y todavía sin push).

8. **Reporta**: repo, rama, hash corto, título, y qué quedó fuera del commit si algo quedó.
