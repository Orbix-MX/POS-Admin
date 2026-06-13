import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, ActivityIndicator } from 'react-native';

import { Screen, Text, Grid, SegmentedControl, StatusBadge } from '@/components/ui';
import { AppHeader, BranchSelectorModal } from '@/components/navigation';
import { TableCard } from '@/components/domain';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useBranchSelector } from '@/hooks/use-branch-selector';
import { fetchDiningAreas, fetchTables } from '@/services/restaurant-service';
import type { DiningArea, RestaurantTable, TableStatus } from '@/services/restaurant-service';
import type { StatusKey } from '@/constants/theme';

const STATUS_MAP: Record<TableStatus, StatusKey> = {
  AVAILABLE: 'available',
  OCCUPIED:  'occupied',
  RESERVED:  'ready',
  BLOCKED:   'rejected',
};

const STATUS_LABEL_MAP: Record<TableStatus, string> = {
  AVAILABLE: 'Libre',
  OCCUPIED:  'Ocupada',
  RESERVED:  'Reservada',
  BLOCKED:   'Bloqueada',
};

const ALL_ZONE = { value: 'todas', label: 'Todas' };

export default function TablesScreen() {
  const theme = useTheme();
  const { select } = useResponsive();
  const cols = select({ phone: 2, tablet: 5 });
  const { modalVisible, activeBranch, availableBranches, openSelector, closeSelector, handleSelect, canSwitch } = useBranchSelector();

  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState('todas');

  const load = useCallback(async () => {
    if (!activeBranch?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [areasData, tablesData] = await Promise.all([
        fetchDiningAreas(activeBranch.id),
        fetchTables(activeBranch.id),
      ]);
      setAreas(areasData.filter((a) => a.isActive));
      setTables(tablesData.filter((t) => t.isActive));
    } catch {
      setError('No se pudieron cargar las mesas.');
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => { void load(); }, [load]);

  const zones = useMemo(() => [
    ALL_ZONE,
    ...areas.map((a) => ({ value: a.id, label: a.name })),
  ], [areas]);

  const filtered = useMemo(() => {
    if (zone === 'todas') return tables;
    return tables.filter((t) => t.areaId === zone);
  }, [tables, zone]);

  const gridData = useMemo(() =>
    filtered.map((t) => ({
      code: t.name,
      status: STATUS_MAP[t.status],
      statusLabel: STATUS_LABEL_MAP[t.status],
      detail: `${t.capacity} personas`,
    })),
    [filtered]);

  const counts = useMemo(() => {
    let available = 0; let occupied = 0; let reserved = 0;
    for (const t of filtered) {
      if (t.status === 'AVAILABLE') available++;
      else if (t.status === 'OCCUPIED') occupied++;
      else if (t.status === 'RESERVED') reserved++;
    }
    return { available, occupied, reserved };
  }, [filtered]);

  return (
    <Screen edges={[]}>
      <AppHeader
        branchName={activeBranch?.name ?? 'Sucursal'}
        searchPlaceholder="Buscar mesa"
        onPressBranch={canSwitch ? openSelector : undefined}
      />
      <BranchSelectorModal
        visible={modalVisible}
        branches={availableBranches}
        activeBranchId={activeBranch?.id ?? null}
        onSelect={handleSelect}
        onClose={closeSelector}
      />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.md }}>
          <Text variant="h2">Mesas</Text>
          <Text variant="label" tone="secondary">
            {activeBranch?.name ?? ''} · {filtered.length} mesas
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: theme.spacing.xl }} />
        ) : error ? (
          <Text variant="body" tone="danger" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>{error}</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
              {zones.length > 1 && (
                <SegmentedControl options={zones} value={zone} onChange={setZone} />
              )}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                {counts.occupied > 0 && <StatusBadge status="occupied" label={`Ocupada · ${counts.occupied}`} />}
                {counts.reserved > 0 && <StatusBadge status="ready" label={`Reservada · ${counts.reserved}`} />}
                {counts.available > 0 && <StatusBadge status="available" label={`Libre · ${counts.available}`} />}
              </View>
            </View>

            {gridData.length === 0 ? (
              <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: theme.spacing.xl }}>
                No hay mesas en esta área.
              </Text>
            ) : (
              <Grid data={gridData} columns={cols} keyExtractor={(t) => t.code} renderItem={(t) => <TableCard {...t} />} />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
