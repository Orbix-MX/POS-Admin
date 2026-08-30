/**
 * Side navigation drawer — Material-flavoured: elevated surface with rounded
 * leading corners, a branded header, tonal selected state, and per-row ripple.
 * Slides in from the left with an eased scrim fade, matching the platform's
 * standard drawer motion rather than a plain modal fade.
 *
 * Most module rows are still prototype placeholders ("Próx." chip), not wired
 * to routes. Inicio, Inventario (products), Ventas, Clientes and Configuración
 * are the live destinations.
 */
import { usePathname, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ripple, useRipple } from '@/components/animations/ripple';
import { OrbixAvatar } from '@/components/ui/orbix-avatar';
import { OrbixGradient } from '@/components/ui/orbix-gradient';
import { OrbixModal } from '@/components/ui/orbix-modal';
import { OrbixText } from '@/components/ui/orbix-text';
import {
  ChartIcon,
  CreditCardIcon,
  HomeIcon,
  LogOutIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  UsersIcon,
  XIcon,
  type IconProps,
} from '@/components/ui/icons';
import { useSignOut } from '@/features/auth/use-auth-mutations';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';

const DRAWER_WIDTH = 300;
const ROW_HEIGHT = 50;
const SCRIM_OPACITY = 0.5;

const OPEN_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) } as const;
const CLOSE_TIMING = { duration: 200, easing: Easing.in(Easing.cubic) } as const;

interface DrawerModule {
  key: string;
  labelKey: 'ventas' | 'inventario' | 'clientes' | 'empleados' | 'reportes' | 'caja';
  Icon: ComponentType<IconProps>;
  /** Live destination; undefined rows render as "Próx." placeholders. */
  route?: '/(app)/products' | '/(app)/pos' | '/(app)/customers';
}

const STATIC_MODULES: Omit<DrawerModule, 'route'>[] = [
  { key: 'ventas', labelKey: 'ventas', Icon: ShoppingBagIcon },
  { key: 'inventario', labelKey: 'inventario', Icon: PackageIcon },
  { key: 'clientes', labelKey: 'clientes', Icon: UsersIcon },
  { key: 'empleados', labelKey: 'empleados', Icon: UsersIcon },
  { key: 'reportes', labelKey: 'reportes', Icon: ChartIcon },
  { key: 'caja', labelKey: 'caja', Icon: CreditCardIcon },
];

export interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
}

/** One nav-drawer row: tonal pill when active, ripple on press, muted "próx." chip when disabled. */
interface DrawerRowProps {
  Icon: ComponentType<IconProps>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  /** Red icon/label — destructive actions (sign out). */
  danger?: boolean;
  trailing?: string;
  onPress?: () => void;
}

const DrawerRow = memo(function DrawerRow({ Icon, label, active = false, disabled = false, danger = false, trailing, onPress }: DrawerRowProps) {
  const theme = useTheme();
  const ripple = useRipple();
  const iconColor = danger
    ? theme.colors.dangerFg
    : active
      ? theme.colors.brandBlue600
      : disabled
        ? theme.colors.mutedForeground
        : theme.colors.foreground;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (disabled) return;
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [disabled, ripple],
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      style={{
        height: ROW_HEIGHT,
        borderRadius: theme.radius.full,
        overflow: 'hidden',
        backgroundColor: active ? theme.colors.brandBlue50 : 'transparent',
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        <Icon size={18} color={iconColor} />
        <OrbixText
          size="sm"
          weight={active ? 'semibold' : 'medium'}
          tone={disabled ? 'mutedForeground' : 'foreground'}
          numberOfLines={1}
          style={danger || active ? { color: iconColor } : undefined}
        >
          {label}
        </OrbixText>
        <View style={{ flex: 1 }} />
        {trailing ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.muted,
            }}
          >
            <OrbixText size="xs" tone="mutedForeground">{trailing}</OrbixText>
          </View>
        ) : null}
      </View>
      <Ripple {...ripple} color={theme.colors.brandBlue300} borderRadius={theme.radius.full} />
    </Pressable>
  );
});

function AppDrawerComponent({ visible, onClose }: AppDrawerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // El drawer ya no se abre solo desde Inicio: la fila activa y el destino de
  // "Inicio" se derivan de la ruta actual en vez de darse por supuestos.
  const pathname = usePathname();
  const onHome = pathname === '/';
  const { t } = useTranslation();
  const { session, refresh } = useAuth();
  const { can } = usePermissions();

  // Permissions are only refetched from the server on cold start; a role/plan
  // change made elsewhere (web admin, backend backfill) wouldn't show up here
  // until the user force-quit the app. Refetching on every open keeps the
  // module list honest without requiring that.
  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  // Inventario, Ventas and Clientes are wired to real screens; each gated on
  // its own permission, not just presence in the list.
  const drawerModules = useMemo<DrawerModule[]>(
    () =>
      STATIC_MODULES.map((mod) => {
        if (mod.key === 'inventario' && can('products:view')) return { ...mod, route: '/(app)/products' as const };
        if (mod.key === 'ventas' && can('orders:create')) return { ...mod, route: '/(app)/pos' as const };
        if (mod.key === 'clientes' && can('customers:view')) return { ...mod, route: '/(app)/customers' as const };
        return mod;
      }),
    [can],
  );
  const signOut = useSignOut();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const progress = useSharedValue(0);

  // The native Modal window is kept up for the whole gesture, not just while
  // `visible` is true: mounting on open and unmounting only once the closing
  // animation has finished. Binding the window straight to `visible` made the
  // drawer vanish instantly on close, with no exit motion at all.
  const [mounted, setMounted] = useState(visible);
  // Whether the window is already on screen. The opening animation is deferred
  // to `onShow`; starting it from a mount effect burns its first frames while
  // Android is still creating the window, so the drawer appeared already
  // half-way in.
  const shown = useRef(false);

  const finishClose = useCallback(() => {
    shown.current = false;
    setMounted(false);
  }, []);

  useEffect(() => {
    if (visible) {
      if (shown.current) progress.value = withTiming(1, OPEN_TIMING);
      else setMounted(true);
      return;
    }
    if (!shown.current) {
      finishClose();
      return;
    }
    progress.value = withTiming(0, CLOSE_TIMING, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [visible, progress, finishClose]);

  const handleShown = useCallback(() => {
    shown.current = true;
    progress.value = withTiming(1, OPEN_TIMING);
  }, [progress]);

  // Both animated views also carry their closed state as a *static* style. On
  // the first frame after the window attaches, Reanimated has not applied its
  // styles yet, so a scrim whose opacity lived only in the animated style got
  // painted fully opaque — a blank sheet flashing behind the drawer.
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * DRAWER_WIDTH }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * SCRIM_OPACITY,
  }));

  const openSettings = () => {
    onClose();
    router.push('/(app)/settings');
  };

  const handleLogout = () => {
    signOut.mutate(undefined, {
      onSuccess: () => {
        setConfirmLogout(false);
        onClose();
      },
    });
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onShow={handleShown}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        {/* Scrim — a full-bleed layer *under* the panel, not a sibling column
            beside it. Laid out in the row flow it only covered the screen minus
            the drawer's width, so the strip behind the panel stayed unshaded
            and the dimming visibly stopped at the panel's edge. */}
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: 0 },
            scrimStyle,
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: DRAWER_WIDTH,
              backgroundColor: theme.colors.card,
              borderTopRightRadius: theme.radius['2xl'],
              borderBottomRightRadius: theme.radius['2xl'],
              overflow: 'hidden',
              transform: [{ translateX: -DRAWER_WIDTH }],
            },
            theme.shadows.lg,
            panelStyle,
          ]}
        >
          {/* Header — branded gradient with identity, mirrors Material's drawer header block. */}
          <OrbixGradient
            variant="primary"
            style={{ paddingTop: insets.top + theme.spacing.lg, paddingBottom: theme.spacing.lg, paddingHorizontal: theme.spacing.lg }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={10}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: theme.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.18)',
                }}
              >
                <XIcon size={15} color={theme.colors.primaryForeground} />
              </Pressable>
            </View>

            <View style={{ marginTop: theme.spacing.sm, gap: 2 }}>
              <OrbixAvatar name={session?.user.fullName ?? 'Orbix'} size={48} />
              <OrbixText
                size="md"
                weight="bold"
                tone="primaryForeground"
                numberOfLines={1}
                style={{ marginTop: theme.spacing.sm }}
              >
                {session?.tenant?.name ?? 'Orbix'}
              </OrbixText>
              <OrbixText size="xs" tone="onDarkMuted" numberOfLines={1}>
                {session?.user.fullName ?? ''}
              </OrbixText>
            </View>
          </OrbixGradient>

          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.sm, paddingTop: theme.spacing.md, gap: 2 }}
            showsVerticalScrollIndicator={false}
          >
            <DrawerRow
              Icon={HomeIcon}
              label={t('drawer.home')}
              active={onHome}
              onPress={onHome ? onClose : () => { onClose(); router.replace('/(app)'); }}
            />

            <OrbixText
              size="xs"
              weight="semibold"
              tone="mutedForeground"
              style={{
                marginTop: theme.spacing.md,
                marginBottom: theme.spacing.xs,
                marginLeft: theme.spacing.lg,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              {t('drawer.sectionModules')}
            </OrbixText>

            {drawerModules.map(({ key, labelKey, Icon, route }) => (
              <DrawerRow
                key={key}
                Icon={Icon}
                label={t(`drawer.modules.${labelKey}`)}
                // Los grupos de expo-router no aparecen en el pathname, así que
                // `/(app)/pos` se compara como `/pos`.
                active={route ? pathname.startsWith(route.replace('/(app)', '')) : false}
                disabled={!route}
                trailing={route ? undefined : t('drawer.comingSoon')}
                onPress={route ? () => { onClose(); router.push(route); } : undefined}
              />
            ))}
          </ScrollView>

          <View
            style={{
              padding: theme.spacing.sm,
              paddingBottom: insets.bottom + theme.spacing.sm,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            <DrawerRow Icon={SettingsIcon} label={t('drawer.settings')} onPress={openSettings} />
            <DrawerRow Icon={LogOutIcon} label={t('drawer.logout')} danger onPress={() => setConfirmLogout(true)} />
          </View>
        </Animated.View>
      </View>

      <OrbixModal
        visible={confirmLogout}
        title={t('drawer.logoutConfirmTitle')}
        description={t('drawer.logoutConfirmDescription')}
        confirmLabel={t('drawer.logout')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={signOut.isPending}
        onConfirm={handleLogout}
        onDismiss={() => setConfirmLogout(false)}
      />
    </Modal>
  );
}

export const AppDrawer = memo(AppDrawerComponent);
