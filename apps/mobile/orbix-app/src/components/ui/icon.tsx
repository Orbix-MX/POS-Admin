/**
 * Icon — thin wrapper over Feather (line-style, matches the design's SVGs).
 * Semantic names decouple screens from the underlying icon set.
 */
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '@/providers/theme-provider';

const ICONS = {
  home: 'home',
  tables: 'grid',
  orders: 'file-text',
  bill: 'credit-card',
  profile: 'user',
  search: 'search',
  bell: 'bell',
  settings: 'sliders',
  location: 'map-pin',
  plus: 'plus',
  minus: 'minus',
  send: 'send',
  close: 'x',
  check: 'check',
  chevronDown: 'chevron-down',
  chevronRight: 'chevron-right',
  arrowRight: 'arrow-right',
  card: 'credit-card',
  cash: 'dollar-sign',
  transfer: 'repeat',
  star: 'star',
  alert: 'alert-circle',
  logout: 'log-out',
  trash: 'trash-2',
  clock: 'clock',
  bag: 'shopping-bag',
  package: 'package',
  truck: 'truck',
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 22, color }: IconProps) {
  const theme = useTheme();
  return <Feather name={ICONS[name]} size={size} color={color ?? theme.colors.text} />;
}
