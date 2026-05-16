---
name: usar db push en lugar de migrate dev
description: La BD de Neon no tiene historial de migraciones alineado — prisma migrate dev detecta drift y requiere reset destructivo
type: feedback
---

Usar `pnpm exec prisma db push` en lugar de `pnpm exec prisma migrate dev` para aplicar cambios al schema de Prisma en este proyecto.

**Why:** La base de datos en Neon ya tenía todas las tablas creadas sin historial de migraciones registrado en Prisma. Ejecutar `migrate dev` detecta drift masivo y solicita resetear la BD (eliminando todos los datos). `db push` sincroniza el schema directamente sin tocar el historial.

**How to apply:** Después de editar `schema.prisma`, ejecutar: `pnpm exec prisma db push` y luego `pnpm exec prisma generate`. No usar `migrate dev` a menos que el proyecto tenga historial de migraciones limpio o se quiera resetear la BD explícitamente.
