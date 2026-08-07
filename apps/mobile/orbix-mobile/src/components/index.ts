/** Public surface of the Orbix design system. Screens import only from here. */

export { OrbixButton, type ButtonSize, type ButtonVariant } from './buttons/orbix-button';
export { BackButton } from './buttons/back-button';
export { GoogleButton, OrDivider } from './buttons/google-button';
export { InlineError } from './ui/inline-error';

export { OrbixCard } from './cards/orbix-card';
export { KpiCard } from './cards/kpi-card';
export { BusinessTypeCard, ListRow } from './cards/business-type-card';

export { OrbixTextField, FieldGroup } from './forms/orbix-text-field';
export { OrbixSelect, type SelectOption } from './forms/orbix-select';
export { OrbixOtpInput } from './forms/orbix-otp-input';

export { OrbixText, type TextTone } from './ui/orbix-text';
export { OrbixInput } from './ui/orbix-input';
export { OrbixGradient, angleToPoints } from './ui/orbix-gradient';
export { OrbixScaffold } from './ui/orbix-scaffold';
export { OrbixLoading, OrbixSkeleton, OrbixSpinner } from './ui/orbix-loading';
export { OrbixStepper, OrbixDots } from './ui/orbix-stepper';
export { OrbixModal } from './ui/orbix-modal';
export { OrbixBottomSheet, type OrbixBottomSheetRef } from './ui/orbix-bottom-sheet';
export { OrbixAvatar, initialsOf } from './ui/orbix-avatar';
export { OrbixToast, toast, toastConfig } from './ui/orbix-toast';

export { Confetti } from './animations/confetti';
export { AnimatedProgressBar, AnimatedSuccessCheck } from './animations/animated-progress';
export { Ripple, useRipple } from './animations/ripple';

export * from './ui/icons';
