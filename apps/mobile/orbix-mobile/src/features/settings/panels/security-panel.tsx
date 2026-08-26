/**
 * Content of "Seguridad" — MFA (TOTP) enable/disable.
 *
 * No scaffold, no back button — same convention as `general-panel.tsx` and
 * `store-panel.tsx`, so `settings/security.tsx` (phone push) and
 * `settings/index.tsx` (tablet detail pane) can both mount it as-is.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  FieldGroup,
  InlineError,
  OrbixButton,
  OrbixModal,
  OrbixText,
  OrbixTextField,
  SettingsRow,
  SettingsSection,
  toast,
} from '@/components';
import { ShieldIcon } from '@/components/ui/icons';
import { buildMfaChallengeSchema, type MfaChallengeValues as CodeValues } from '@/features/auth/schemas';
import { useConfirmMfa, useDisableMfa, useSetupMfa } from '@/features/settings/use-mfa';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

/** Setup flow: fetch the secret → scan + confirm → show backup codes. */
function MfaSetupModal({ onClose, onEnabled }: { onClose: () => void; onEnabled: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const setupMfa = useSetupMfa();
  const confirmMfa = useConfirmMfa();

  const [step, setStep] = useState<'loading' | 'scan' | 'backupCodes'>('loading');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => buildMfaChallengeSchema(t), [t]);
  const { control, handleSubmit } = useForm<CodeValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  });

  const startSetup = setupMfa.mutate;
  useEffect(() => {
    startSetup(undefined, {
      onSuccess: (result) => {
        setOtpauthUrl(result.otpauthUrl);
        setSecret(result.secret);
        setStep('scan');
      },
      onError: () => setFormError(t('settings.security.setup.error')),
    });
    // Runs once, on mount — the setup call must fire exactly when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConfirm = useCallback(
    (values: CodeValues) => {
      setFormError(null);
      confirmMfa.mutate(values.code, {
        onSuccess: (result) => {
          setBackupCodes(result.backupCodes);
          setStep('backupCodes');
        },
        onError: (error) => setFormError(toUserMessage(error, t)),
      });
    },
    [confirmMfa, t],
  );

  const onCopyBackupCodes = useCallback(async () => {
    await Clipboard.setStringAsync(backupCodes.join('\n'));
    toast.success(t('settings.security.setup.copied'));
  }, [backupCodes, t]);

  return (
    <OrbixModal visible title={t('settings.security.setup.title')} onDismiss={onClose}>
      {step === 'loading' ? (
        <InlineError message={formError} />
      ) : step === 'scan' ? (
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <OrbixText size="sm" tone="mutedForeground" style={{ textAlign: 'center' }}>
              {t('settings.security.setup.scanDescription')}
            </OrbixText>
            {otpauthUrl ? (
              <View style={{ padding: theme.spacing.md, backgroundColor: '#fff', borderRadius: theme.radius.lg }}>
                <QRCode value={otpauthUrl} size={172} />
              </View>
            ) : null}
            <OrbixText size="xs" tone="mutedForeground" style={{ textAlign: 'center' }}>
              {t('settings.security.setup.secretLabel')}
            </OrbixText>
            <OrbixText size="sm" weight="semibold" selectable>
              {secret}
            </OrbixText>
          </View>

          <InlineError message={formError} />

          <FieldGroup>
            <OrbixTextField
              control={control}
              name="code"
              label={t('settings.security.setup.codeLabel')}
              placeholder={t('settings.security.setup.codePlaceholder')}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onConfirm)}
            />
          </FieldGroup>

          <OrbixButton
            label={t('settings.security.setup.confirm')}
            onPress={handleSubmit(onConfirm)}
            loading={confirmMfa.isPending}
          />
        </View>
      ) : (
        <View style={{ gap: theme.spacing.lg }}>
          <View>
            <OrbixText size="md" weight="semibold">
              {t('settings.security.setup.backupCodesTitle')}
            </OrbixText>
            <OrbixText size="sm" tone="mutedForeground" style={{ marginTop: theme.spacing.xs }}>
              {t('settings.security.setup.backupCodesDescription')}
            </OrbixText>
          </View>

          <View
            style={{
              gap: theme.spacing.xs,
              padding: theme.spacing.md,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.muted,
            }}
          >
            {backupCodes.map((code) => (
              <OrbixText key={code} size="sm" weight="semibold" selectable style={{ fontVariant: ['tabular-nums'] }}>
                {code}
              </OrbixText>
            ))}
          </View>

          <OrbixButton
            label={t('settings.security.setup.copyBackupCodes')}
            variant="secondary"
            onPress={() => void onCopyBackupCodes()}
          />
          <OrbixButton
            label={t('settings.security.setup.done')}
            onPress={() => {
              onEnabled();
              onClose();
            }}
          />
        </View>
      )}
    </OrbixModal>
  );
}

function MfaDisableModal({ onClose, onDisabled }: { onClose: () => void; onDisabled: () => void }) {
  const { t } = useTranslation();
  const disableMfa = useDisableMfa();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(() => buildMfaChallengeSchema(t), [t]);
  const { control, handleSubmit } = useForm<CodeValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  });

  const onConfirm = useCallback(
    (values: CodeValues) => {
      setFormError(null);
      disableMfa.mutate(values.code, {
        onSuccess: () => {
          onDisabled();
          onClose();
        },
        onError: (error) => setFormError(toUserMessage(error, t)),
      });
    },
    [disableMfa, onClose, onDisabled, t],
  );

  return (
    <OrbixModal
      visible
      title={t('settings.security.disableModal.title')}
      description={t('settings.security.disableModal.description')}
      confirmLabel={t('settings.security.disableModal.confirm')}
      cancelLabel={t('common.cancel')}
      destructive
      loading={disableMfa.isPending}
      onConfirm={handleSubmit(onConfirm)}
      onDismiss={onClose}
    >
      <FieldGroup>
        <InlineError message={formError} />
        <OrbixTextField
          control={control}
          name="code"
          label={t('settings.security.setup.codeLabel')}
          placeholder={t('settings.security.setup.codePlaceholder')}
          keyboardType="number-pad"
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleSubmit(onConfirm)}
        />
      </FieldGroup>
    </OrbixModal>
  );
}

export function SecurityPanel() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { session, refresh } = useAuth();

  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  const mfaEnabled = session?.user.mfaEnabled ?? false;

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <SettingsSection title={t('settings.security.sectionAccount')}>
        <SettingsRow
          icon={<ShieldIcon size={16} color={theme.colors.brandBlue600} />}
          iconTint={theme.colors.brandBlue50}
          title={t('settings.security.mfaTitle')}
          description={
            mfaEnabled ? t('settings.security.mfaDescriptionOn') : t('settings.security.mfaDescriptionOff')
          }
          isLast
          onPress={() => (mfaEnabled ? setShowDisable(true) : setShowSetup(true))}
        />
      </SettingsSection>

      {showSetup ? (
        <MfaSetupModal
          onClose={() => setShowSetup(false)}
          onEnabled={() => {
            void refresh();
            toast.success(t('settings.security.mfaEnabled'));
          }}
        />
      ) : null}

      {showDisable ? (
        <MfaDisableModal
          onClose={() => setShowDisable(false)}
          onDisabled={() => {
            void refresh();
            toast.success(t('settings.security.mfaDisabled'));
          }}
        />
      ) : null}
    </View>
  );
}
