/**
 * Horizontal category filter for the POS grid.
 *
 * The prototype decorates each chip with an emoji; real categories carry no
 * glyph, so the badge falls back to the category initial — data-driven and
 * stable across tenants. Counts come from the loaded product page rather than a
 * separate aggregate call, so they describe what the grid can actually show.
 */
import { memo, useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { OrbixGradient, OrbixText } from '@/components';
import { useTheme } from '@/hooks/use-theme';

export interface CategoryChip {
  /** `null` is the "all products" chip. */
  id: string | null;
  label: string;
  count: number;
}

interface CategoryChipsProps {
  categories: CategoryChip[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

interface ChipProps {
  chip: CategoryChip;
  active: boolean;
  onSelect: (id: string | null) => void;
}

function Chip({ chip, active, onSelect }: ChipProps) {
  const theme = useTheme();
  const handlePress = useCallback(() => onSelect(chip.id), [chip.id, onSelect]);

  const glyph = chip.id === null ? '•' : chip.label.charAt(0).toUpperCase();

  const body = (
    <>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? 'rgba(255,255,255,0.24)' : theme.colors.muted,
        }}
      >
        <OrbixText size="sm" weight="bold" tone={active ? 'onDark' : 'mutedForeground'}>
          {glyph}
        </OrbixText>
      </View>
      <OrbixText size="sm" weight="semibold" tone={active ? 'onDark' : 'foreground'}>
        {chip.label}
      </OrbixText>
      <View
        style={{
          paddingHorizontal: 5,
          paddingVertical: 1,
          borderRadius: theme.radius.full,
          backgroundColor: active ? 'rgba(255,255,255,0.22)' : theme.colors.muted,
        }}
      >
        <OrbixText size="xs" weight="bold" tone={active ? 'onDark' : 'mutedForeground'}>
          {String(chip.count)}
        </OrbixText>
      </View>
    </>
  );

  const inner = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    paddingLeft: 9,
    paddingRight: 13,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${chip.label} (${chip.count})`}
    >
      {active ? (
        <OrbixGradient variant="primary" style={inner}>
          {body}
        </OrbixGradient>
      ) : (
        <View
          style={[
            inner,
            {
              borderWidth: 1.5,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            },
          ]}
        >
          {body}
        </View>
      )}
    </Pressable>
  );
}

function CategoryChipsComponent({ categories, selectedId, onSelect }: CategoryChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, paddingBottom: 4 }}
    >
      {categories.map((chip) => (
        <Chip
          key={chip.id ?? '__all__'}
          chip={chip}
          active={chip.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

export const CategoryChips = memo(CategoryChipsComponent);
