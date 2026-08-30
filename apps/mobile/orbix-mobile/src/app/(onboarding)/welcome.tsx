/**
 * Onboarding carousel.
 *
 * Swipeable (a paging `ScrollView`) as well as button-driven, because the
 * prototype's dot indicator implies swipe even though a web prototype cannot
 * express it. The icon tile and the copy cross-fade between slides while the
 * gradient background stays put — matching the design's static wash.
 */
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { OrbixButton, OrbixDots, OrbixGradient, OrbixScaffold, OrbixText } from '@/components';
import { ONBOARDING_SLIDES } from '@/features/onboarding/slides';
import { useTheme } from '@/hooks/use-theme';
import { sessionStorage } from '@/services/auth/session-storage';

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === ONBOARDING_SLIDES.length - 1;

  const finish = useCallback(() => {
    sessionStorage.markOnboardingCompleted();
    router.replace('/(auth)/sign-up');
  }, [router]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    const next = index + 1;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  }, [isLast, index, width, finish]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(page);
    },
    [width],
  );

  // The carousel bleeds to the screen edges, so the scaffold's own horizontal
  // padding is removed and re-applied per slide.
  const horizontalPadding = theme.spacing['2xl'];

  return (
    <OrbixScaffold horizontalPadding={0} topPadding={theme.spacing.md}>
      <View style={{ paddingHorizontal: horizontalPadding, alignItems: 'flex-end' }}>
        <Pressable
          onPress={finish}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.skip')}
          style={{ padding: theme.spacing.xs + 2 }}
        >
          <OrbixText size="base" weight="medium" tone="mutedForeground">
            {t('common.skip')}
          </OrbixText>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        style={{ flex: 1 }}
      >
        {ONBOARDING_SLIDES.map((slide, slideIndex) => (
          <View
            key={slide.id}
            style={{
              width,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing['3xl'],
              paddingHorizontal: horizontalPadding,
            }}
            accessible
            accessibilityLabel={`${t(slide.titleKey)}. ${t(slide.descriptionKey)}`}
          >
            {slideIndex === index ? (
              <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(140)}>
                <OrbixGradient
                  variant="primary"
                  style={[
                    {
                      width: 112,
                      height: 112,
                      borderRadius: theme.radius['3xl'] + 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    theme.shadows.primary,
                  ]}
                >
                  <slide.Icon size={52} color={theme.colors.primaryForeground} />
                </OrbixGradient>
              </Animated.View>
            ) : (
              <View style={{ width: 112, height: 112 }} />
            )}

            <View style={{ gap: theme.spacing.sm + 2, alignItems: 'center' }}>
              <OrbixText size="2xl" weight="bold" align="center" leading="tight">
                {t(slide.titleKey)}
              </OrbixText>
              <OrbixText
                size="md"
                tone="mutedForeground"
                align="center"
                leading="normal"
                style={{ maxWidth: 270 }}
              >
                {t(slide.descriptionKey)}
              </OrbixText>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: horizontalPadding, gap: theme.spacing.xl }}>
        <OrbixDots count={ONBOARDING_SLIDES.length} activeIndex={index} />
        <OrbixButton label={isLast ? t('common.start') : t('common.continue')} onPress={goNext} />
      </View>
    </OrbixScaffold>
  );
}
