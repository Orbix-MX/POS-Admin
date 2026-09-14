/**
 * Caja — el estado del turno y las acciones que lo mueven.
 *
 * Sección propia y no una pestaña del POS: el corte lo hace el dueño o el
 * supervisor, en un momento distinto al de cobrar, y meterlo en la rejilla de
 * productos obliga a abandonar la venta en curso para llegar a él.
 *
 * Las cifras salen del `summary` que calcula el servidor — ver
 * `session-summary-card.tsx`.
 */
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import {
  AppDrawer,
  DrawerButton,
  ChartIcon,
  CheckIcon,
  MinusIcon,
  OrbixCard,
  OrbixScaffold,
  OrbixSkeleton,
  OrbixText,
  PlusIcon,
  ShieldIcon,
  WalletIcon,
  type OrbixBottomSheetRef,
} from '@/components';
import { CreditCardIcon } from '@/components/ui/icons';
import { CashActions, type CashAction } from '@/features/cash/cash-actions';
import { MovementSheet, type MovementKind } from '@/features/cash/movement-sheet';
import { MovementsList } from '@/features/cash/movements-list';
import { OpenCashSessionPanel } from '@/features/cash/open-session-panel';
import { SessionSummaryCard, StatusPill } from '@/features/cash/session-summary-card';
import { UserBreakdownCard } from '@/features/cash/user-breakdown-card';
import { useCashHandovers } from '@/features/cash/use-cash-count';
import { useActiveCashSession, useHandoverTracking } from '@/features/cash/use-cash-session';
import { useAuth } from '@/hooks/use-auth';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import type { CashMovementType } from '@/types/api';
import { toUserMessage } from '@/utils/error-message';

/**
 * Aviso propio de los estados en los que la caja existe pero no opera.
 *
 * `EN_ARQUEO` y `PENDIENTE_REVISION` son estados vivos —`GET /active` los
 * devuelve— en los que ningún movimiento entra. Sin decirlo, el cajero ve una
 * caja abierta y un POS que rechaza cada venta sin explicar por qué.
 */
function FrozenNotice({ status }: { status: 'EN_ARQUEO' | 'PENDIENTE_REVISION' }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const isReview = status === 'PENDIENTE_REVISION';
  const color = isReview ? theme.colors.warningFg : theme.colors.infoFg;

  return (
    <OrbixCard
      style={{
        gap: 4,
        borderColor: color,
        backgroundColor: isReview ? theme.colors.warningBg : theme.colors.infoBg,
      }}
    >
      <OrbixText size="sm" weight="bold" style={{ color }}>
        {t(isReview ? 'cash.frozen.reviewTitle' : 'cash.frozen.countingTitle')}
      </OrbixText>
      <OrbixText size="sm" style={{ color }}>
        {t(isReview ? 'cash.frozen.reviewHint' : 'cash.frozen.countingHint')}
      </OrbixText>
    </OrbixCard>
  );
}

export default function CajaScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { session: authSession } = useAuth();
  const { can } = usePermissions();
  useCurrencyFormatVersion();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [movementKind, setMovementKind] = useState<MovementKind>('EXPENSE');
  const movementSheet = useRef<OrbixBottomSheetRef>(null);

  const { data: session, isLoading, isFetching, error, refetch } = useActiveCashSession();
  const { data: handovers } = useCashHandovers(session?.id);

  // Deja constancia de que este usuario tomó la caja. Es el relevo de turno: la
  // caja ya estaba abierta por otra persona y hasta ahora eso no dejaba rastro.
  useHandoverTracking(session);

  const hasBranch = Boolean(authSession?.branchId);
  const canView = can('cash:view');

  /**
   * Solo una caja `ABIERTA` acepta movimientos. `EN_ARQUEO` y
   * `PENDIENTE_REVISION` la tienen congelada a propósito, y el servidor los
   * rechaza — deshabilitar aquí evita un viaje que solo puede fallar.
   */
  const canMove = session?.status === 'ABIERTA';

  const openMovement = (kind: MovementKind) => {
    setMovementKind(kind);
    movementSheet.current?.expand();
  };

  const actions = useMemo<CashAction[]>(() => {
    if (!session) return [];
    const list: CashAction[] = [];

    if (can('cash:manage')) {
      list.push(
        {
          key: 'expense',
          label: t('cash.movementKind.EXPENSE'),
          Icon: MinusIcon,
          tintBg: 'dangerBg',
          tintFg: 'dangerFg',
          onPress: () => openMovement('EXPENSE'),
          disabled: !canMove,
        },
        {
          key: 'income',
          label: t('cash.movementKind.INCOME'),
          Icon: PlusIcon,
          tintBg: 'successBg',
          tintFg: 'successFg',
          onPress: () => openMovement('INCOME'),
          disabled: !canMove,
        },
      );
    }

    // Sacar efectivo pesa más que anotar un gasto: permiso propio y más
    // restrictivo (`pos.cash:withdraw`), tal como lo declara el controlador.
    if (can('pos.cash:withdraw')) {
      list.push({
        key: 'withdraw',
        label: t('cash.movementKind.WITHDRAWAL'),
        Icon: WalletIcon,
        tintBg: 'warningBg',
        tintFg: 'warningFg',
        onPress: () => openMovement('WITHDRAWAL'),
        disabled: !canMove,
      });
    }

    // Arqueo y corte NO se ocultan por permiso: el servidor los resuelve con
    // permiso propio *o* con el PIN de un supervisor, y esconderlos rompería
    // justo el caso para el que existe el PIN (D3 del plan). El arqueo sí se
    // inhabilita en `PENDIENTE_REVISION`: ahí la caja espera una firma, no un
    // conteo más.
    list.push(
      {
        key: 'count',
        label: t('cash.count.title'),
        Icon: CheckIcon,
        tintBg: 'infoBg',
        tintFg: 'infoFg',
        onPress: () => router.push('/(app)/caja/arqueo'),
        disabled: session.status === 'PENDIENTE_REVISION',
      },
      {
        key: 'close',
        label: t('cash.close.title'),
        Icon: ShieldIcon,
        tintBg: 'brandBlue50',
        tintFg: 'brandBlue600',
        onPress: () => router.push('/(app)/caja/corte'),
      },
      {
        key: 'history',
        label: t('cash.history.title'),
        Icon: ChartIcon,
        tintBg: 'neutralBg',
        tintFg: 'neutralFg',
        onPress: () => router.push('/(app)/caja/historial'),
      },
    );

    return list;
  }, [session, canMove, can, t, router]);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <DrawerButton onPress={() => setDrawerVisible(true)} accessibilityLabel={t('drawer.title')} />
      <View style={{ flex: 1 }}>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground">
          {t('drawer.modules.caja').toUpperCase()}
        </OrbixText>
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('cash.title')}
        </OrbixText>
      </View>
      {session ? (
        <StatusPill status={session.status} label={t(`cash.status.${session.status}`)} />
      ) : null}
    </View>
  );

  // Sin el permiso no se pide nada al servidor (`useActiveCashSession` va
  // deshabilitado), así que la pantalla tiene que decirlo por su cuenta en vez
  // de quedarse en un skeleton eterno.
  if (!canView) {
    return (
      <OrbixScaffold contentStyle={{ gap: theme.spacing.xl }}>
        {header}
        <AppDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <CreditCardIcon size={38} color={theme.colors.mutedForeground} />
          <OrbixText size="base" weight="semibold">
            {t('errors.forbidden')}
          </OrbixText>
        </View>
      </OrbixScaffold>
    );
  }

  return (
    <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
      {header}
      <AppDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      {!hasBranch || isLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          <OrbixSkeleton height={180} radius={theme.radius.xl} />
          <OrbixSkeleton height={64} radius={theme.radius.lg} />
        </View>
      ) : error ? (
        <OrbixCard style={{ gap: 4 }}>
          <OrbixText size="sm" weight="semibold" tone="dangerFg">
            {toUserMessage(error, t)}
          </OrbixText>
        </OrbixCard>
      ) : !session ? (
        <OpenCashSessionPanel />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.brandBlue500}
            />
          }
        >
          {session.status === 'EN_ARQUEO' || session.status === 'PENDIENTE_REVISION' ? (
            <FrozenNotice status={session.status} />
          ) : null}

          <SessionSummaryCard
            session={session}
            labels={{
              expectedCash: t('cash.expectedCash'),
              openingAmount: t('cash.openingAmount'),
              sales: t('cash.sales'),
              income: t('cash.income'),
              expense: t('cash.expense'),
              withdrawal: t('cash.withdrawal'),
              refund: t('cash.refund'),
              cash: t('pos.cash'),
              card: t('pos.card'),
              transfer: t('pos.transfer'),
              movements: t('cash.movements'),
              openedBy: t('cash.openedBy'),
              usdDrawer: t('cash.usdDrawer'),
              noMovements: t('cash.noMovements'),
            }}
          />

          <UserBreakdownCard
            summary={session.summary}
            handovers={handovers ?? []}
            labels={{
              title: t('cash.byUser.title'),
              handoversTitle: t('cash.byUser.handovers'),
              sales: t('cash.sales'),
              movements: t('cash.movements'),
              netCash: t('cash.byUser.netCash'),
              stillIn: t('cash.byUser.stillIn'),
              noUsers: t('cash.byUser.none'),
            }}
          />

          <CashActions actions={actions} />

          <MovementsList
            movements={session.movements}
            labels={{
              title: t('cash.movementsTitle'),
              empty: t('cash.noMovements'),
              typeName: (type: CashMovementType) => t(`cash.movementType.${type}`),
            }}
          />
        </ScrollView>
      )}

      <MovementSheet
        sheetRef={movementSheet}
        kind={movementKind}
        summary={session?.summary ?? null}
        onDone={() => void refetch()}
      />
    </OrbixScaffold>
  );
}
