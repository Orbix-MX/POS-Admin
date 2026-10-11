/**
 * Qué cajón opera **este dispositivo**.
 *
 * No es un selector que aparece al abrir la caja: la caja pertenece al puesto y
 * el dispositivo *es* el puesto, así que preguntarlo en cada apertura sería
 * fricción pura. Se declara una vez y se olvida.
 *
 * Existe porque sin él el binding se adquiere **por carrera**:
 * `resolveCashRegister` toma la primera caja libre por orden alfabético, así que
 * el mostrador es «Caja 1» el lunes y la farmacia lo es el martes — los cortes
 * quedan etiquetados al revés. Y si el dispositivo pierde el binding (app
 * reinstalada, relevo de turno), con dos sesiones vivas `GET /active` devuelve
 * *la que abrió este usuario* → ninguna, y la terminal dice «no hay caja
 * abierta» con su cajón lleno.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { OrbixButton, OrbixCard, OrbixInput, OrbixText } from '@/components';
import { CheckIcon, CreditCardIcon, PlusIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';
import { usePermissions } from '@/hooks/use-permissions';
import { toUserMessage } from '@/utils/error-message';

import {
  useActiveCashRegisterId,
  useCashRegisters,
  useCashSessionCapacity,
  useCreateCashRegister,
} from './use-cash-session';

export function CashRegisterPicker() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { can } = usePermissions();

  const { cashRegisterId, selectCashRegister } = useActiveCashRegisterId();
  const { data: registers, isLoading } = useCashRegisters();
  const { data: capacity } = useCashSessionCapacity();
  const createRegister = useCreateCashRegister();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const canManage = can('cash:manage');

  if (isLoading) {
    return (
      <OrbixText size="sm" tone="mutedForeground">
        {t('common.loading')}
      </OrbixText>
    );
  }

  const list = registers ?? [];

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: 4 }}>
        <OrbixText size="sm" weight="semibold">
          {t('cash.registers.title')}
        </OrbixText>
        <OrbixText size="sm" tone="mutedForeground">
          {t('cash.registers.hint')}
        </OrbixText>
      </View>

      <OrbixCard padded={false}>
        {/* «La que toque» conserva el comportamiento actual: para una sucursal
            de un solo cajón, elegir no aporta nada. */}
        <RegisterRow
          label={t('cash.registers.auto')}
          detail={t('cash.registers.autoHint')}
          selected={!cashRegisterId}
          onPress={() => selectCashRegister(undefined)}
          isLast={list.length === 0}
        />

        {list.map((register, index) => (
          <RegisterRow
            key={register.id}
            label={register.name}
            detail={
              register.liveSession
                ? t('cash.registers.busy', { email: register.liveSession.openedByEmail ?? '' })
                : t('cash.registers.free')
            }
            selected={cashRegisterId === register.id}
            onPress={() => selectCashRegister(register.id)}
            isLast={index === list.length - 1}
          />
        ))}
      </OrbixCard>

      {capacity ? (
        <OrbixText size="xs" tone="mutedForeground">
          {capacity.maxSessions === null
            ? t('cash.registers.capacityUnlimited', { open: capacity.openSessions })
            : t('cash.registers.capacity', {
                open: capacity.openSessions,
                max: capacity.maxSessions,
              })}
        </OrbixText>
      ) : null}

      {/* Alta de caja: sin esto, «todas las cajas están abiertas» es un
          callejón sin salida desde la app. */}
      {canManage ? (
        adding ? (
          <View style={{ gap: theme.spacing.sm }}>
            <OrbixInput
              value={name}
              onChangeText={setName}
              placeholder={t('cash.registers.namePlaceholder')}
              autoFocus
            />
            {createRegister.error ? (
              <OrbixText size="xs" tone="dangerFg">
                {toUserMessage(createRegister.error, t)}
              </OrbixText>
            ) : null}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <OrbixButton
                  label={t('common.cancel')}
                  variant="secondary"
                  onPress={() => {
                    setAdding(false);
                    setName('');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <OrbixButton
                  label={t('cash.registers.add')}
                  disabled={!name.trim()}
                  loading={createRegister.isPending}
                  onPress={() =>
                    createRegister.mutate(
                      { name: name.trim() },
                      {
                        onSuccess: (created) => {
                          // Quien la crea casi siempre es quien la va a operar.
                          selectCashRegister(created.id);
                          setAdding(false);
                          setName('');
                        },
                      },
                    )
                  }
                />
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
          >
            <PlusIcon size={14} color={theme.colors.brandBlue600} />
            <OrbixText size="sm" weight="semibold" style={{ color: theme.colors.brandBlue600 }}>
              {t('cash.registers.add')}
            </OrbixText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function RegisterRow({
  label,
  detail,
  selected,
  onPress,
  isLast,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  isLast: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? theme.colors.brandBlue50 : theme.colors.muted,
        }}
      >
        <CreditCardIcon
          size={15}
          color={selected ? theme.colors.brandBlue600 : theme.colors.mutedForeground}
        />
      </View>

      <View style={{ flex: 1, gap: 1 }}>
        <OrbixText size="sm" weight={selected ? 'semibold' : 'regular'}>
          {label}
        </OrbixText>
        <OrbixText size="xs" tone="mutedForeground">
          {detail}
        </OrbixText>
      </View>

      {selected ? <CheckIcon size={16} color={theme.colors.brandBlue600} /> : null}
    </Pressable>
  );
}
