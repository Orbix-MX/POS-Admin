/**
 * Grid — simple fixed-column grid via flex rows. Keeps equal-width cells (each
 * cell is flex:1) with consistent gaps; fills the last row with spacers so items
 * don't stretch. For long lists prefer FlatList numColumns; this is for small,
 * static sections.
 */
import { Fragment } from 'react';
import { View } from 'react-native';

export interface GridProps<T> {
  data: T[];
  columns: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
}

export function Grid<T>({ data, columns, gap = 12, renderItem, keyExtractor }: GridProps<T>) {
  const rows: T[][] = [];
  for (let i = 0; i < data.length; i += columns) {
    rows.push(data.slice(i, i + columns));
  }

  return (
    <View style={{ gap }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap }}>
          {row.map((item, colIndex) => {
            const index = rowIndex * columns + colIndex;
            return (
              <View key={keyExtractor?.(item, index) ?? index} style={{ flex: 1 }}>
                {renderItem(item, index)}
              </View>
            );
          })}
          {row.length < columns &&
            Array.from({ length: columns - row.length }).map((_, i) => (
              <Fragment key={`spacer-${i}`}>
                <View style={{ flex: 1 }} />
              </Fragment>
            ))}
        </View>
      ))}
    </View>
  );
}
