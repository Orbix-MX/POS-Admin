# Plan de accesibilidad — orbix-mobile

Estado del código al momento de escribir este plan (no reinventar lo que ya existe):

- **Tamaño de texto**: `OrbixText` ya usa `allowFontScaling` — el Dynamic Type del
  SO ya funciona. Falta un override propio de la app, independiente del ajuste
  del SO.
- **Reduce motion**: `useReducedMotion()` ya se respeta en `orbix-card.tsx`,
  `orbix-loading.tsx`, `confetti.tsx`, `animated-progress.tsx`.
- **Botones**: ≥44dp en `orbix-button.tsx`, con `hitSlop` en el tamaño `sm`.
- **Theming**: `ThemeProvider` (`src/providers/theme-provider.tsx`) ya persiste
  `mode` (`system|light|dark`) vía `themeService`/MMKV y expone todo por
  `useTheme()` — es el punto natural para colgar nuevas preferencias de
  accesibilidad sin tocar cada pantalla.

Falta: override de tamaño de fuente independiente del SO, contraste alto,
dictado de voz explícito, auditoría de labels de screen reader, y una pantalla
de Configuración → Accesibilidad que junte todo.

## Fase 0 — Infraestructura (1-2 días)

Extender `ThemeProvider`/`themeService` (mismo patrón que `mode`) con dos
preferencias nuevas persistidas en MMKV:

- `fontScale: 'default' | 'large' | 'largest'` — multiplicador sobre
  `theme.typography.fontSize` en `build-theme.ts`, independiente del
  `allowFontScaling` del SO.
- `contrast: 'default' | 'high'` — variante de paleta: bordes más oscuros,
  texto con mayor ratio, sin transparencias tipo `rgba(255,255,255,0.24)` en
  chips activos (`category-chips.tsx`).

Ambas viajan por el mismo `ThemeContext` que ya consume toda la app vía
`useTheme()` — cero cambios en cada pantalla individual.

## Fase 1 — Pantalla de Configuración → Accesibilidad (1 día)

Nuevo `src/app/(app)/settings/accessibility.tsx` (mismo patrón que
`settings/general.tsx` / `settings/security.tsx`):

- Selector de tamaño de texto, con preview en vivo.
- Toggle de alto contraste.
- Toggle de "reducir movimiento" — override manual (hoy solo sigue el ajuste
  del SO vía `useReducedMotion()`, sin control propio en la app).
- Enlace al accessibility settings nativo del SO (no se puede activar
  TalkBack/VoiceOver desde la app, pero sí enlazar).

## Fase 2 — Contraste y color (2-3 días)

Auditoría real de `theme/tokens.ts` contra WCAG AA (4.5:1 texto normal, 3:1
texto grande/UI). Sospechosos principales: `mutedForeground` y textos sobre
gradientes (`onDarkMuted: 'rgba(255,255,255,0.55)'`). Definir la paleta `high`
contrast como tokens paralelos (mismo mecanismo que `darkWashStart` vs.
`washStart`), no lógica condicional dispersa en componentes.

## Fase 3 — Tamaño de controles táctiles (1-2 días)

Auditoría sistemática de `hitSlop`/tamaño mínimo 44dp en todos los `Pressable`
de features, no solo en el design system. El bug del stepper de productos
(dots de 28px sin `hitSlop`, corregido en esta misma sesión) es exactamente el
tipo de caso a barrer. Checklist por feature: POS grid, chips, iconos de
acción en tablas/listas, tab bar.

## Fase 4 — Dictado de voz (2-3 días, la más incierta)

Los teclados nativos de Android/iOS ya traen dictado por voz en cualquier
`TextInput` normal — confirmar que ningún `OrbixTextField` lo bloquea
(`keyboardType`, `secureTextEntry` en campos que no lo requieren).

Para dictado explícito con botón de micrófono (búsqueda de productos, notas,
descripción) se necesita una librería nativa (`@react-native-voice/voice` o
el Speech-to-Text de Expo) — nuevo módulo nativo, rebuild, y permisos de
micrófono en ambas plataformas. Empezar por el buscador de POS
(`pos/index.tsx`) como caso piloto antes de generalizar.

## Fase 5 — Screen reader / semántica (2-3 días)

Auditoría de cobertura de `accessibilityLabel`/`accessibilityRole`/
`accessibilityState` — ya hay buen uso en varios lugares (`StepDots`, tab bar,
botones), pero falta pasada sistemática sobre iconos sin texto (acciones de
tabla, badges de estado) y verificar orden de foco con TalkBack/VoiceOver
real.

## Fase 6 — QA y guardarraíles (continuo)

- Regla de lint (`eslint-plugin-react-native-a11y` o similar) para exigir
  `accessibilityLabel` en `Pressable`/`TouchableOpacity` sin hijos de texto.
- Checklist manual de humo por release: TalkBack en Android, VoiceOver en
  iOS, tamaño de fuente al máximo del SO, alto contraste activado — en las
  pantallas críticas (login, POS, checkout).

## Orden recomendado

0 → 1 → 3 primero (bajo riesgo, alto impacto, reutilizan infraestructura ya
construida) → 2 → 5 → 4 al final (la más cara y menos crítica para un ERP/POS
usado mayormente por personal vidente).
