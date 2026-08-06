/**
 * PermisosPanel — Panel de Permisos: decisiones de negocio individuales (no
 * RBAC). Mismo backing store que la web (`/tenants/current/settings`,
 * merge-patch). Cada fila persiste al cambiar, optimista con reversión si falla.
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';

import { Text, Icon, ToggleSwitch } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import { fetchTenantSettings, updateTenantSettings, type TenantSettings } from '@/services/settings-service';
import { useDeviceStore } from '@/store/device-store';

interface ToggleDef {
  key: Extract<keyof TenantSettings, string>;
  section: string;
  label: string;
  description: string;
  defaultValue: boolean;
}

// Un solo lugar para agregar futuros toggles del panel.
const TOGGLES: ToggleDef[] = [
  {
    key: 'requireCounterReference',
    section: 'Comandas',
    label: 'Órdenes con referencia',
    description: 'Al crear una nueva orden de mostrador, pedir una referencia de cuenta (ej. nombre del cliente). Si se desactiva, la orden se abre directo con la referencia "Mostrador".',
    defaultValue: true,
  },
];

interface PermisosPanelProps {
  onClose: () => void;
}

export function PermisosPanel({ onClose }: PermisosPanelProps) {
  const theme = useTheme();
  const [settings, setSettings] = useState<TenantSettings>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTenantSettings()
      .then((s) => { if (alive) setSettings(s); })
      .catch(() => { if (alive) setError('No se pudo cargar el panel de permisos.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const toggle = useCallback((def: ToggleDef, next: boolean) => {
    setError(null);
    const previous = settings[def.key];
    setSavingKey(def.key);
    setSettings((s) => ({ ...s, [def.key]: next })); // optimista
    updateTenantSettings({ [def.key]: next })
      .then((updated) => {
        setSettings(updated);
        // Aplica ya mismo a las capabilities en memoria (comandas, etc.) sin
        // esperar al próximo PIN login que revalida el tenant completo.
        useDeviceStore.getState().patchBusinessSettings({ [def.key]: next });
      })
      .catch(() => {
        setSettings((s) => ({ ...s, [def.key]: previous }));
        setError('No se pudo guardar el cambio. Intenta de nuevo.');
      })
      .finally(() => setSavingKey(null));
  }, [settings]);

  const sections = [...new Set(TOGGLES.map((t) => t.section))];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }}>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="chevronRight" size={20} color={theme.colors.textSecondary} />
        </Pressable>
        <Text variant="title">Panel de Permisos</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.xl }}>
          <Text variant="small" tone="secondary">
            Decisiones de negocio individuales: cada interruptor cambia cómo se comporta la app para tu equipo.
          </Text>

          {error && (
            <View style={{ backgroundColor: theme.colors.dangerSoft, borderRadius: theme.radius.lg, padding: theme.spacing.md }}>
              <Text variant="small" tone="danger">{error}</Text>
            </View>
          )}

          {sections.map((section) => (
            <View key={section} style={{ gap: theme.spacing.sm }}>
              <Text variant="eyebrow" tone="secondary">{section}</Text>
              <View style={{ backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg }}>
                {TOGGLES.filter((t) => t.section === section).map((def, i, arr) => {
                  const value = (settings[def.key] as boolean | undefined) ?? def.defaultValue;
                  return (
                    <View
                      key={def.key}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: theme.spacing.md,
                        padding: theme.spacing.lg,
                        borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                        borderBottomColor: theme.colors.border,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="label">{def.label}</Text>
                        <Text variant="caption" tone="muted">{def.description}</Text>
                      </View>
                      {savingKey === def.key ? (
                        <ActivityIndicator color={theme.colors.primary} />
                      ) : (
                        <ToggleSwitch value={value} onChange={(v) => toggle(def, v)} disabled={savingKey != null} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
