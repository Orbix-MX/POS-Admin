---
name: commit-push
description: Crea un commit sin atribución de IA (nada de Co-Authored-By) y lo sube a su rama remota, con fetch y status visibles antes del push. Úsala cuando el usuario pida "commitea y sube", "commit y push", "súbelo".
---

# commit-push

`commit` + `git push`. **Sube código a un remoto: es irreversible en la práctica.**

Sigue **entero** el procedimiento de la skill `commit` — repo objetivo, leer el diff,
redactar el mensaje, enseñar y esperar el sí, stage con rutas explícitas, verificar
trailers. Todas sus reglas duras siguen vigentes aquí, en particular:

- **Nunca `Co-Authored-By`**, `Claude-Session:`, `Generated with Claude`,
  `noreply@anthropic.com` ni trailers de agente.
- **Nunca commitear sin el sí explícito** del usuario en este turno.
- **Nunca `--no-verify`**, nunca arrastrar cambios ajenos a la tarea.

Este documento solo añade lo del push.

## Reglas duras del push

- **Nunca `--force` ni `--force-with-lease`.** Si el push es rechazado, para y reporta.
  Reescribir historia publicada no es decisión tuya.
- **Nunca pushear a `main`/`master`** sin que el usuario lo pida con esas palabras en este
  turno. La rama de trabajo de `orbix-admin` es `dev`.
- **Nunca `git push --all`, `--tags` ni `--mirror`.** Una rama, la actual.
- **Nunca resolver una divergencia por tu cuenta** (`pull --rebase`, merge, reset).
  Si local y remoto divergieron, para y pregunta.

## Pasos añadidos

1. **Haz el commit** siguiendo `commit` de principio a fin, incluida la pausa de aprobación
   y la verificación de trailers del paso 7. No sigas si esa verificación no está limpia:
   un trailer de IA pusheado ya no se quita sin reescribir historia.

2. **Fetch y estado, visibles.** Antes de cualquier push, siempre, sin saltárselo:
   ```bash
   git -C <repo> fetch origin
   git -C <repo> status -sb
   ```
   Enseña la salida. Interpreta la línea `##`:
   - `ahead N` limpio → adelante.
   - `behind` o `ahead N, behind M` → **para**. Divergiste. Reporta y pregunta; no rebases.
   - sin upstream → la rama es nueva en el remoto, lo dices en el reporte.

3. **Enseña qué se va a subir**, no solo cuántos commits:
   ```bash
   git -C <repo> log --oneline @{u}..HEAD    # o origin/<rama>..HEAD si no hay upstream
   ```
   Si aparece un commit que no es tuyo de esta sesión, dilo — puede ser trabajo del usuario
   que no esperaba subir todavía.

4. **Push.**
   ```bash
   git -C <repo> push origin <rama>          # con upstream ya configurado
   git -C <repo> push -u origin <rama>       # primera vez de esa rama
   ```

5. **Confirma que llegó**, no des por hecho el exit 0:
   ```bash
   git -C <repo> status -sb
   ```
   La línea `##` debe quedar sin `ahead`.

6. **Reporta**: repo, rama, hash corto, título del commit, y a qué remoto/rama fue.

## Si el push es rechazado

`non-fast-forward` significa que alguien más subió antes. Tu commit local está a salvo — no
se perdió nada. Reporta la situación tal cual y pregunta si integra con `pull --rebase` o con
merge. No lo elijas tú, y bajo ninguna circunstancia fuerces el push.
