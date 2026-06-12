import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen, Text, Grid, SearchBar, SegmentedControl } from '@/components/ui';
import { ProductCard } from '@/components/domain';
import { useTheme } from '@/providers/theme-provider';
import { useResponsive } from '@/hooks/use-responsive';

const CATEGORIES = [
  { value: 'platos', label: 'Platos' },
  { value: 'tacos', label: 'Tacos' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'postres', label: 'Postres' },
];

// Static placeholder catalog — UI foundation only.
const PRODUCTS = [
  { name: 'Ribeye 380g', price: '$420' },
  { name: 'Salmón a la parrilla', price: '$310' },
  { name: 'Hamburguesa Orbix', price: '$210' },
  { name: 'Pasta Alfredo', price: '$185' },
  { name: 'Taco Pastor', price: '$38' },
  { name: 'Margarita', price: '$125' },
  { name: 'Café Americano', price: '$45' },
  { name: 'Cheesecake', price: '$95' },
];

export default function OrdersScreen() {
  const theme = useTheme();
  const { select } = useResponsive();
  const [cat, setCat] = useState('platos');
  const cols = select({ phone: 2, tablet: 4 });

  return (
    <Screen>
      <View style={{ padding: theme.spacing.xl, gap: theme.spacing.md, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <Text variant="h2">Comanda</Text>
        <SearchBar placeholder="Buscar producto…" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <SegmentedControl options={CATEGORIES} value={cat} onChange={setCat} />
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.xl }}>
        <Grid data={PRODUCTS} columns={cols} keyExtractor={(p) => p.name} renderItem={(p) => <ProductCard {...p} />} />
      </ScrollView>
    </Screen>
  );
}
