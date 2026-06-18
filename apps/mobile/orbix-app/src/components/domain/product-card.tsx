/**
 * ProductCard — catalog tile (photo placeholder, name, price, add button).
 * Tapping the card or the + both fire onAdd unless onPress is given.
 */
import { View, Pressable } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Text, Icon } from '@/components/ui';

export interface ProductCardProps {
  name: string;
  price: string; // formatted, e.g. "$420"
  onPress?: () => void;
  onAdd?: () => void;
}

export function ProductCard({ name, price, onPress, onAdd }: ProductCardProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress ?? onAdd}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        opacity: pressed ? 0.95 : 1,
      })}
    >
      {/* photo placeholder */}
      <View style={{ height: 78, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="eyebrow" tone="muted">
          foto
        </Text>
      </View>
      <View style={{ padding: theme.spacing.md }}>
        <Text variant="label" numberOfLines={2} style={{ minHeight: 34 }}>
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Text variant="mono" tone="success">
            {price}
          </Text>
          <Pressable
            onPress={onAdd}
            hitSlop={8}
            style={{
              width: 30,
              height: 30,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="plus" size={18} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
