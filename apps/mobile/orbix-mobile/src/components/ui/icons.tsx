/**
 * Icon set, transcribed from the SVG paths used in the Claude Design prototype
 * (Lucide geometry, 24×24 viewBox, round caps and joins).
 *
 * Kept as explicit components rather than a generic `<Icon name>` so tree-shaking
 * works and a typo is a compile error.
 */
import { memo } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

const DEFAULT_SIZE = 24;

/* ── Navigation ──────────────────────────────────────────────────────────── */

export const ChevronLeftIcon = memo(function ChevronLeftIcon({
  size = 15,
  color,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size * (9 / 15)} height={size} viewBox="0 0 9 15" fill="none">
      <Path
        d="M8 1 1.5 7.5 8 14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

export const ChevronRightIcon = memo(function ChevronRightIcon({
  size = 14,
  color,
  strokeWidth = 1.6,
}: IconProps) {
  return (
    <Svg width={size * (8 / 14)} height={size} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1l6 6-6 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

export const ChevronDownIcon = memo(function ChevronDownIcon({
  size = 14,
  color,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <Svg width={size} height={size * (8 / 14)} viewBox="0 0 14 8" fill="none">
      <Path
        d="M1 1l6 6 6-6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

export const CheckIcon = memo(function CheckIcon({ size = 9, color, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg width={size} height={size * (7 / 9)} viewBox="0 0 9 7" fill="none">
      <Path
        d="M1 3.5 3.2 6 8 1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

/* ── Onboarding slides ───────────────────────────────────────────────────── */

/** Slide 1 — "manage from anywhere". */
export const SmartphoneIcon = memo(function SmartphoneIcon({
  size = DEFAULT_SIZE,
  color,
  strokeWidth = 1.6,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={7}
        y={2}
        width={10}
        height={20}
        rx={2.2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={12}
        y1={18}
        x2={12.01}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
});

/** Slide 2 — "sales, inventory and customers". */
export const BoxIcon = memo(function BoxIcon({
  size = DEFAULT_SIZE,
  color,
  strokeWidth = 1.6,
}: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M16.5 9.4 7.5 4.2" {...stroke} />
      <Path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        {...stroke}
      />
      <Path d="M3.3 7 12 12l8.7-5" {...stroke} />
      <Line x1={12} y1={22} x2={12} y2={12} {...stroke} />
    </Svg>
  );
});

/** Slide 3 — "synced in real time". */
export const SyncIcon = memo(function SyncIcon({
  size = DEFAULT_SIZE,
  color,
  strokeWidth = 1.6,
}: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 2v6h-6" {...stroke} />
      <Path d="M3 22v-6h6" {...stroke} />
      <Path d="M21 8a9 9 0 0 0-15-4.4L3 8" {...stroke} />
      <Path d="M3 16a9 9 0 0 0 15 4.4l3-3.4" {...stroke} />
    </Svg>
  );
});

/* ── Home "first steps" list ─────────────────────────────────────────────── */

export const PackageIcon = memo(function PackageIcon({
  size = 14,
  color,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

export const UsersIcon = memo(function UsersIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...stroke} />
      <Circle cx={9} cy={7} r={4} {...stroke} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" {...stroke} />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...stroke} />
    </Svg>
  );
});

export const CreditCardIcon = memo(function CreditCardIcon({
  size = 14,
  color,
  strokeWidth = 2,
}: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={1} y={4} width={22} height={16} rx={2} {...stroke} />
      <Line x1={1} y1={10} x2={23} y2={10} {...stroke} />
    </Svg>
  );
});

/* ── Drawer / settings ───────────────────────────────────────────────────── */

export const PlusIcon = memo(function PlusIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={12} y1={5} x2={12} y2={19} {...stroke} />
      <Line x1={5} y1={12} x2={19} y2={12} {...stroke} />
    </Svg>
  );
});

export const MinusIcon = memo(function MinusIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={12} x2={19} y2={12} {...stroke} />
    </Svg>
  );
});

export const SearchIcon = memo(function SearchIcon({ size = 16, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} {...stroke} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} {...stroke} />
    </Svg>
  );
});

export const TrashIcon = memo(function TrashIcon({ size = 16, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18" {...stroke} />
      <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...stroke} />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" {...stroke} />
      <Line x1={10} y1={11} x2={10} y2={17} {...stroke} />
      <Line x1={14} y1={11} x2={14} y2={17} {...stroke} />
    </Svg>
  );
});

export const LogOutIcon = memo(function LogOutIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...stroke} />
      <Path d="M16 17l5-5-5-5" {...stroke} />
      <Line x1={21} y1={12} x2={9} y2={12} {...stroke} />
    </Svg>
  );
});

export const XIcon = memo(function XIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={18} y1={6} x2={6} y2={18} {...stroke} />
      <Line x1={6} y1={6} x2={18} y2={18} {...stroke} />
    </Svg>
  );
});

export const HomeIcon = memo(function HomeIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11.5 12 4l9 7.5" {...stroke} />
      <Path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" {...stroke} />
    </Svg>
  );
});

export const MenuIcon = memo(function MenuIcon({ size = 22, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={3} y1={6} x2={21} y2={6} {...stroke} />
      <Line x1={3} y1={12} x2={21} y2={12} {...stroke} />
      <Line x1={3} y1={18} x2={21} y2={18} {...stroke} />
    </Svg>
  );
});

export const SettingsIcon = memo(function SettingsIcon({ size = 20, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} {...stroke} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        {...stroke}
      />
    </Svg>
  );
});

export const ChartIcon = memo(function ChartIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={18} y1={20} x2={18} y2={10} {...stroke} />
      <Line x1={12} y1={20} x2={12} y2={4} {...stroke} />
      <Line x1={6} y1={20} x2={6} y2={14} {...stroke} />
    </Svg>
  );
});

export const ShoppingBagIcon = memo(function ShoppingBagIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" {...stroke} />
      <Line x1={3} y1={6} x2={21} y2={6} {...stroke} />
      <Path d="M16 10a4 4 0 0 1-8 0" {...stroke} />
    </Svg>
  );
});

/* ── Feedback ────────────────────────────────────────────────────────────── */

/** The 42×42 success check, drawn with a dash offset so it can be animated. */
export const SuccessCheckIcon = memo(function SuccessCheckIcon({
  size = 42,
  color,
  strokeWidth = 3.5,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 42 42" fill="none">
      <Path
        d="M11 22l7 7 14-16"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

/* ── Settings ────────────────────────────────────────────────────────────── */

export const StoreIcon = memo(function StoreIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9V6a1 1 0 0 1 .3-.7l1.4-1.4A1 1 0 0 1 5.4 3.6h13.2a1 1 0 0 1 .7.3l1.4 1.4a1 1 0 0 1 .3.7v3" {...stroke} />
      <Path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" {...stroke} />
      <Path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" {...stroke} />
      <Path d="M9 20v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" {...stroke} />
    </Svg>
  );
});

export const WalletIcon = memo(function WalletIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5" {...stroke} />
      <Path d="M18 12h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a2 2 0 0 1 0-4Z" {...stroke} />
      <Path d="M3 8h13" {...stroke} />
    </Svg>
  );
});

export const PercentIcon = memo(function PercentIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={19} y1={5} x2={5} y2={19} {...stroke} />
      <Circle cx={6.5} cy={6.5} r={2.5} {...stroke} />
      <Circle cx={17.5} cy={17.5} r={2.5} {...stroke} />
    </Svg>
  );
});

export const ShieldIcon = memo(function ShieldIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

export const PrinterIcon = memo(function PrinterIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9V3h12v6" {...stroke} />
      <Rect x={2} y={9} width={20} height={9} rx={2} {...stroke} />
      <Path d="M6 15h12v6H6Z" {...stroke} />
    </Svg>
  );
});

export const PlugIcon = memo(function PlugIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 22v-5" {...stroke} />
      <Path d="M9 8V2" {...stroke} />
      <Path d="M15 8V2" {...stroke} />
      <Path d="M6 8h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6Z" {...stroke} />
    </Svg>
  );
});

export const InfoIcon = memo(function InfoIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} {...stroke} />
      <Line x1={12} y1={11} x2={12} y2={16.5} {...stroke} />
      <Line x1={12} y1={7.5} x2={12.01} y2={7.5} {...stroke} />
    </Svg>
  );
});

export const ImageIcon = memo(function ImageIcon({ size = 24, color, strokeWidth = 1.6 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} {...stroke} />
      <Circle cx={9} cy={9} r={2} {...stroke} />
      <Path d="m21 15-5-5L5 21" {...stroke} />
    </Svg>
  );
});

export const MapPinIcon = memo(function MapPinIcon({ size = 14, color, strokeWidth = 2 }: IconProps) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" {...stroke} />
      <Circle cx={12} cy={10} r={3} {...stroke} />
    </Svg>
  );
});

export const GoogleGlyph = memo(function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <Path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.8-2 13.3-5.2l-6.2-5.2C29.1 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.8 35.9 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </Svg>
  );
});
