/**
 * Avatar with an initials fallback.
 *
 * Falls back to a gradient-backed monogram rather than a placeholder image, so
 * a user with no photo still gets a branded, tenant-themed identity chip.
 */
import { Image } from 'expo-image';
import { memo } from 'react';
import { View } from 'react-native';

import { OrbixGradient } from '@/components/ui/orbix-gradient';
import { OrbixText } from '@/components/ui/orbix-text';

export interface OrbixAvatarProps {
  name: string;
  imageUrl?: string;
  size?: number;
}

/** "Ana María Pérez" → "AP"; single-word names give one letter. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function OrbixAvatarComponent({ name, imageUrl, size = 40 }: OrbixAvatarProps) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        accessibilityLabel={name}
        // Downscaled on the native side; avoids decoding a 2 MP photo for 40 px.
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <OrbixGradient
      variant="primary"
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <OrbixText
          size={size >= 48 ? 'lg' : 'sm'}
          weight="bold"
          tone="primaryForeground"
          accessibilityLabel={name}
        >
          {initialsOf(name)}
        </OrbixText>
      </View>
    </OrbixGradient>
  );
}

export const OrbixAvatar = memo(OrbixAvatarComponent);
