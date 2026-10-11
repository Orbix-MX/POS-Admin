/**
 * Importar un catálogo desde una hoja de cálculo.
 *
 * Una sola pantalla para productos y clientes: el contrato del servidor es el
 * mismo y lo único que cambia son los textos. Si hicieran falta dos, el
 * repositorio estaría mal cortado.
 *
 * El orden de la pantalla es el del trabajo real, que no ocurre aquí:
 *
 *   1. bajar la plantilla y **sacarla del teléfono** —trece columnas no se
 *      llenan con el pulgar—;
 *   2. llenarla donde haya teclado;
 *   3. volver y subirla.
 *
 * El resultado se cuenta entero, errores incluidos, y los errores se pueden
 * copiar: corregirlos exige volver al archivo, y apuntar a mano «fila 148, SKU
 * PAN-23, precio inválido» de una pantalla es absurdo.
 */
import * as Clipboard from 'expo-clipboard';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { OrbixButton } from '@/components/buttons/orbix-button';
import { InlineError } from '@/components/ui/inline-error';
import { OrbixCard } from '@/components/cards/orbix-card';
import { OrbixText } from '@/components/ui/orbix-text';
import { toast } from '@/components/ui/orbix-toast';
import { useTheme } from '@/hooks/use-theme';
import type { ImportEntity, ImportResult } from '@/repositories/import-repository';
import { toUserMessage } from '@/utils/error-message';

import { FileTooLargeError, useDownloadTemplate, useUploadImport } from './use-import';

export interface ImportScreenProps {
  entity: ImportEntity;
}

function ImportScreenComponent({ entity }: ImportScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const download = useDownloadTemplate(entity);
  const upload = useUploadImport(entity);

  const [result, setResult] = useState<ImportResult | null>(null);

  const busy = download.isPending || upload.isPending;

  const handleUpload = () => {
    setResult(null);
    upload.mutate(undefined, {
      onSuccess: (value) => {
        // `null` = el usuario cerró el selector. No es un resultado y no debe
        // pintar un recuento de ceros como si hubiera importado algo.
        if (value) setResult(value);
      },
    });
  };

  const handleDownload = (format: 'xlsx' | 'csv') => {
    download.mutate(format, {
      onSuccess: ({ file, shared }) => {
        if (!shared) toast.info(t('import.savedTo', { path: file.uri }));
      },
    });
  };

  const copyErrors = async () => {
    if (!result?.errors.length) return;
    const text = result.errors
      .map((e) => t('import.errorLine', { row: e.row, sku: e.sku ?? '—', message: e.message }))
      .join('\n');
    await Clipboard.setStringAsync(text);
    toast.success(t('import.errorsCopied'));
  };

  const uploadError = upload.error;

  return (
    <ScrollView
      contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing['3xl'] }}
      keyboardShouldPersistTaps="handled"
    >
      <OrbixCard style={{ gap: theme.spacing.sm }}>
        <OrbixText size="base" weight="semibold">
          {t(`import.${entity}.title`)}
        </OrbixText>
        <OrbixText size="sm" tone="mutedForeground">
          {t(`import.${entity}.hint`)}
        </OrbixText>
      </OrbixCard>

      {/* Paso 1 — la plantilla sale del teléfono */}
      <OrbixCard style={{ gap: theme.spacing.md }}>
        <StepTitle index={1} label={t('import.step1')} />
        <OrbixText size="sm" tone="mutedForeground">
          {t('import.step1Hint')}
        </OrbixText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <OrbixButton
              label={t('import.downloadXlsx')}
              onPress={() => handleDownload('xlsx')}
              loading={download.isPending && download.variables === 'xlsx'}
              disabled={busy}
            />
          </View>
          <View style={{ flex: 1 }}>
            <OrbixButton
              variant="secondary"
              label={t('import.downloadCsv')}
              onPress={() => handleDownload('csv')}
              loading={download.isPending && download.variables === 'csv'}
              disabled={busy}
            />
          </View>
        </View>
        <InlineError message={download.error ? toUserMessage(download.error, t) : null} />
      </OrbixCard>

      {/* Paso 2 — vuelve llena */}
      <OrbixCard style={{ gap: theme.spacing.md }}>
        <StepTitle index={2} label={t('import.step2')} />
        <OrbixText size="sm" tone="mutedForeground">
          {t('import.step2Hint')}
        </OrbixText>
        <OrbixButton
          label={t('import.pickFile')}
          onPress={handleUpload}
          loading={upload.isPending}
          disabled={busy}
        />
        <InlineError
          message={
            uploadError
              ? uploadError instanceof FileTooLargeError
                ? t('import.tooLarge', { mb: Math.ceil(uploadError.size / (1024 * 1024)) })
                : toUserMessage(uploadError, t)
              : null
          }
        />
      </OrbixCard>

      {result ? <ResultCard result={result} onCopyErrors={copyErrors} /> : null}
    </ScrollView>
  );
}

function StepTitle({ index, label }: { index: number; label: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.muted,
        }}
      >
        <OrbixText size="xs" weight="bold">
          {String(index)}
        </OrbixText>
      </View>
      <OrbixText size="sm" weight="semibold">
        {label}
      </OrbixText>
    </View>
  );
}

/**
 * El recuento, con los errores enteros.
 *
 * Se enseña `totalRows` y no solo los aciertos a propósito: una importación de
 * 412 filas con 4 errores es un éxito, pero esas 4 líneas existen y esconderlas
 * hace que el negocio descubra el hueco semanas después, vendiendo algo que no
 * está en el catálogo.
 */
function ResultCard({ result, onCopyErrors }: { result: ImportResult; onCopyErrors: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const failed = result.errors.length;

  return (
    <OrbixCard style={{ gap: theme.spacing.md }}>
      <OrbixText size="base" weight="semibold">
        {failed === 0 ? t('import.doneClean') : t('import.donePartial')}
      </OrbixText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        <Tally label={t('import.rows')} value={result.totalRows} />
        <Tally label={t('import.created')} value={result.created} />
        <Tally label={t('import.updated')} value={result.updated} />
        <Tally label={t('import.failed')} value={failed} tone={failed ? 'destructive' : undefined} />
      </View>

      {failed > 0 ? (
        <>
          <View style={{ gap: 6 }}>
            {result.errors.slice(0, MAX_LISTED_ERRORS).map((error, index) => (
              <OrbixText key={`${error.row}-${index}`} size="sm" tone="mutedForeground">
                {t('import.errorLine', {
                  row: error.row,
                  sku: error.sku ?? '—',
                  message: error.message,
                })}
              </OrbixText>
            ))}
            {failed > MAX_LISTED_ERRORS ? (
              <OrbixText size="xs" tone="mutedForeground">
                {t('import.moreErrors', { count: failed - MAX_LISTED_ERRORS })}
              </OrbixText>
            ) : null}
          </View>

          {/* Copiar y no solo mirar: la corrección ocurre en el archivo, que
              está en otro dispositivo. */}
          <OrbixButton variant="secondary" label={t('import.copyErrors')} onPress={onCopyErrors} />
        </>
      ) : null}
    </OrbixCard>
  );
}

/**
 * Cuántos errores caben en pantalla antes de que la lista deje de leerse. El
 * resto no se pierde: el botón de copiar se lleva los del resultado completo.
 */
const MAX_LISTED_ERRORS = 12;

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'destructive';
}) {
  return (
    <View style={{ minWidth: 78 }}>
      <OrbixText size="xs" tone="mutedForeground">
        {label}
      </OrbixText>
      <OrbixText size="lg" weight="bold" tone={tone} style={{ fontVariant: ['tabular-nums'] }}>
        {String(value)}
      </OrbixText>
    </View>
  );
}

export const ImportScreen = memo(ImportScreenComponent);
