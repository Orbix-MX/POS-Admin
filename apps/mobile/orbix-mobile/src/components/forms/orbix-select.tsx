/**
 * Select field: a trigger styled like `OrbixInput` that opens a bottom sheet.
 *
 * A native picker was rejected because it cannot be themed per tenant, and the
 * prototype's `<select>` renders as a bordered 44 px field on both platforms.
 */
import type BottomSheet from '@gorhom/bottom-sheet';
import { useCallback, useRef } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { OrbixBottomSheet } from '@/components/ui/orbix-bottom-sheet';
import { OrbixText } from '@/components/ui/orbix-text';
import { ChevronDownIcon, CheckIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

export interface SelectOption {
  value: string;
  label: string;
}

export interface OrbixSelectProps<TValues extends FieldValues> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  /** Sheet header; defaults to `label`. */
  sheetTitle?: string;
}

export function OrbixSelect<TValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  sheetTitle,
}: OrbixSelectProps<TValues>) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheet>(null);

  const open = useCallback(() => sheetRef.current?.expand(), []);
  const close = useCallback(() => sheetRef.current?.close(), []);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = options.find((option) => option.value === field.value);
        const message = fieldState.error?.message;

        return (
          <Animated.View layout={LinearTransition.duration(180)} style={{ flex: 1 }}>
            <OrbixText
              size="sm"
              weight="medium"
              tone="mutedForeground"
              style={{ marginBottom: theme.spacing.xs + 2 }}
            >
              {label}
            </OrbixText>

            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityValue={{ text: selected?.label ?? placeholder ?? '' }}
              accessibilityHint={message}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 44,
                paddingHorizontal: theme.spacing.md,
                borderWidth: 1,
                borderColor: message ? theme.colors.dangerFg : theme.colors.border,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.card,
              }}
            >
              <OrbixText size="md" tone={selected ? 'foreground' : 'mutedForeground'} numberOfLines={1}>
                {selected?.label ?? placeholder ?? ''}
              </OrbixText>
              <ChevronDownIcon size={14} color={theme.colors.mutedForeground} />
            </Pressable>

            {message ? (
              <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)}>
                <OrbixText
                  size="xs"
                  tone="dangerFg"
                  style={{ marginTop: theme.spacing.xs + 1 }}
                  accessibilityRole="alert"
                >
                  {message}
                </OrbixText>
              </Animated.View>
            ) : null}

            <OrbixBottomSheet ref={sheetRef} title={sheetTitle ?? label}>
              <View style={{ gap: 2 }}>
                {options.map((option) => {
                  const isSelected = option.value === field.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        field.onChange(option.value);
                        close();
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={option.label}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        // 48 px keeps every row above the minimum touch target.
                        minHeight: 48,
                        paddingHorizontal: theme.spacing.md,
                        borderRadius: theme.radius.lg,
                        backgroundColor: isSelected ? theme.colors.muted : 'transparent',
                      }}
                    >
                      <OrbixText size="md" weight={isSelected ? 'semibold' : 'regular'}>
                        {option.label}
                      </OrbixText>
                      {isSelected ? <CheckIcon size={14} color={theme.colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </OrbixBottomSheet>
          </Animated.View>
        );
      }}
    />
  );
}
