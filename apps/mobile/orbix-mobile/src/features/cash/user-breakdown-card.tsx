/**
 * Qué movió cada persona durante el turno, y quién estuvo delante del cajón.
 *
 * Dos listas, no una, porque responden preguntas distintas:
 *
 * - **Movimientos por persona** — «¿de quién es este faltante?». Sale del
 *   `summary.byUser` que calcula el servidor. Solo ve a quien movió dinero.
 * - **Bitácora de relevos** — «¿quién pudo tocar el cajón?». Registra presencia.
 *   Alguien que entró, consultó y no vendió aparece aquí y no arriba.
 *
 * Ninguna se pinta si no aporta: con un solo operador y sin relevos, ambas
 * sobran y la tarjeta no se monta.
 */
import { memo } from 'react';
import { View } from 'react-native';

import { OrbixCard } from '@/components/cards/orbix-card';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';
import type { CashHandover, CashSessionSummary } from '@/repositories/cash-repository';

import { formatCurrency } from '@/features/pos/pos-totals';

export interface UserBreakdownLabels {
  title: string;
  handoversTitle: string;
  sales: string;
  movements: string;
  netCash: string;
  /** «Sigue en la caja» — un tramo sin cierre. */
  stillIn: string;
  noUsers: string;
}

function hour(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface UserBreakdownCardProps {
  summary: CashSessionSummary | null;
  handovers: CashHandover[];
  labels: UserBreakdownLabels;
}

function UserBreakdownCardComponent({ summary, handovers, labels }: UserBreakdownCardProps) {
  const theme = useTheme();

  const byUser = summary?.byUser ?? [];
  // Un turno de una sola persona sin relevos no necesita desglose: la cifra ya
  // está arriba y repetirla con su nombre es ruido.
  const showUsers = byUser.length > 1;
  const showHandovers = handovers.length > 1;

  if (!showUsers && !showHandovers) return null;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {showUsers ? (
        <View style={{ gap: theme.spacing.sm }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground">
            {labels.title.toUpperCase()}
          </OrbixText>

          <OrbixCard style={{ gap: theme.spacing.md }}>
            {byUser.map((user, index) => (
              <View key={user.userId ?? `anon-${index}`} style={{ gap: 4 }}>
                {index > 0 ? (
                  <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: theme.spacing.sm }} />
                ) : null}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <OrbixText size="sm" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                    {user.name}
                  </OrbixText>
                  <OrbixText size="sm" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatCurrency(user.sales)}
                  </OrbixText>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <OrbixText size="xs" tone="mutedForeground">
                    {user.movementsCount} {labels.movements}
                  </OrbixText>
                  {/* El neto del cajón es lo que se compara contra un descuadre:
                      solo efectivo en pesos, que es lo que se cuenta al arquear. */}
                  <OrbixText
                    size="xs"
                    tone={user.netCash < 0 ? 'dangerFg' : 'mutedForeground'}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {labels.netCash}: {user.netCash < 0 ? '−' : ''}
                    {formatCurrency(Math.abs(user.netCash))}
                  </OrbixText>
                </View>
              </View>
            ))}
          </OrbixCard>
        </View>
      ) : null}

      {showHandovers ? (
        <View style={{ gap: theme.spacing.sm }}>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground">
            {labels.handoversTitle.toUpperCase()}
          </OrbixText>

          <OrbixCard style={{ gap: theme.spacing.sm }}>
            {handovers.map((handover) => (
              <View
                key={handover.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}
              >
                <OrbixText size="sm" numberOfLines={1} style={{ flex: 1 }}>
                  {handover.name}
                </OrbixText>
                {/* Un tramo sin cierre significa "seguía dentro", no que se
                    perdiera la hora de salida: en un móvil esa señal no existe. */}
                <OrbixText
                  size="xs"
                  tone={handover.leftAt ? 'mutedForeground' : 'successFg'}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {hour(handover.enteredAt)}
                  {handover.leftAt ? ` – ${hour(handover.leftAt)}` : ` · ${labels.stillIn}`}
                </OrbixText>
              </View>
            ))}
          </OrbixCard>
        </View>
      ) : null}
    </View>
  );
}

export const UserBreakdownCard = memo(UserBreakdownCardComponent);
