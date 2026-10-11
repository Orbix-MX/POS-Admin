import { BoxIcon, SmartphoneIcon, SyncIcon, type IconProps } from '@/components';

/** The three carousel slides, in prototype order. */
export interface OnboardingSlide {
  id: string;
  Icon: React.ComponentType<IconProps>;
  titleKey: 'onboarding.slide1.title' | 'onboarding.slide2.title' | 'onboarding.slide3.title';
  descriptionKey:
    | 'onboarding.slide1.description'
    | 'onboarding.slide2.description'
    | 'onboarding.slide3.description';
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    id: 'anywhere',
    Icon: SmartphoneIcon,
    titleKey: 'onboarding.slide1.title',
    descriptionKey: 'onboarding.slide1.description',
  },
  {
    id: 'operations',
    Icon: BoxIcon,
    titleKey: 'onboarding.slide2.title',
    descriptionKey: 'onboarding.slide2.description',
  },
  {
    id: 'realtime',
    Icon: SyncIcon,
    titleKey: 'onboarding.slide3.title',
    descriptionKey: 'onboarding.slide3.description',
  },
] as const;
