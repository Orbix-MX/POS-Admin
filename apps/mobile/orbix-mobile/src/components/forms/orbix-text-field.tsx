/**
 * `OrbixInput` bound to React Hook Form, with label and animated validation.
 *
 * Screens never wire `Controller` themselves — doing it here is what keeps the
 * error animation, the accessibility wiring and the "next field" keyboard
 * behaviour identical across every form in the app.
 */
import { forwardRef, useMemo } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { View, type TextInput, type TextInputProps } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { OrbixText } from '@/components/ui/orbix-text';
import { OrbixInput } from '@/components/ui/orbix-input';
import { useTheme } from '@/hooks/use-theme';

export interface OrbixTextFieldProps<TValues extends FieldValues>
  extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  rightAdornment?: React.ReactNode;
  /** Height of the field; 44 matches the prototype's form inputs. */
  height?: number;
}

function OrbixTextFieldInner<TValues extends FieldValues>(
  { control, name, label, rightAdornment, height = 44, ...inputProps }: OrbixTextFieldProps<TValues>,
  ref: React.ForwardedRef<TextInput>,
) {
  const theme = useTheme();
  const errorId = useMemo(() => `${name}-error`, [name]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const message = fieldState.error?.message;

        return (
          <Animated.View layout={LinearTransition.duration(180)}>
            <OrbixText
              size="sm"
              weight="medium"
              tone="mutedForeground"
              style={{ marginBottom: theme.spacing.xs + 2 }}
              nativeID={`${name}-label`}
            >
              {label}
            </OrbixText>

            <OrbixInput
              ref={ref}
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              hasError={Boolean(message)}
              rightAdornment={rightAdornment}
              height={height}
              accessibilityLabel={label}
              accessibilityLabelledBy={`${name}-label`}
              accessibilityHint={message}
              {...inputProps}
            />

            {message ? (
              <Animated.View
                entering={FadeInDown.duration(180)}
                exiting={FadeOut.duration(120)}
                accessibilityLiveRegion="polite"
                nativeID={errorId}
              >
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
          </Animated.View>
        );
      }}
    />
  );
}

/**
 * Cast preserves the generic through `forwardRef`, which otherwise erases it
 * and would force every call site to annotate its form values manually.
 */
export const OrbixTextField = forwardRef(OrbixTextFieldInner) as <TValues extends FieldValues>(
  props: OrbixTextFieldProps<TValues> & { ref?: React.ForwardedRef<TextInput> },
) => React.ReactElement;

/** Spacer used between stacked fields, so screens don't hardcode margins. */
export function FieldGroup({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={{ gap: theme.spacing.md + 2 }}>{children}</View>;
}
