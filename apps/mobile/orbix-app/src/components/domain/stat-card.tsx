/**
 * StatCard — a single home/dashboard metric (label · big value · hint).
 * `mono` renders the value in JetBrains Mono (money/counters).
 */
import { Card, Text, type TextTone } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  hintTone?: TextTone;
  mono?: boolean;
}

export function StatCard({ label, value, hint, hintTone = 'secondary', mono }: StatCardProps) {
  const theme = useTheme();
  return (
    <Card padding={theme.spacing.xl} style={{ flex: 1 }}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Text
        variant={mono ? 'price' : 'h1'}
        style={mono ? { fontSize: 28, lineHeight: 32, marginTop: 6 } : { marginTop: 4 }}
        tone={mono ? 'success' : 'default'}
      >
        {value}
      </Text>
      {hint && (
        <Text variant="caption" tone={hintTone} style={{ marginTop: 2 }}>
          {hint}
        </Text>
      )}
    </Card>
  );
}
