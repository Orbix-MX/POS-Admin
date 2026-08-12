/**
 * State for the company-creation wizard.
 *
 * The draft is written to MMKV on every change, so closing the app mid-flow
 * (or crashing) resumes exactly where the user was, including the step index.
 * Drafts older than a week are discarded — resuming a stale one is more
 * confusing than starting over.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { StorageKeys } from '@/constants/storage-keys';
import { EMPTY_DRAFT, type WizardDraft } from '@/features/tenant/wizard-schemas';
import { kvStorage } from '@/services/storage/kv-storage';

const TOTAL_STEPS = 4;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface WizardContextValue {
  draft: WizardDraft;
  totalSteps: number;
  /** True when the current draft came from a previous session. */
  wasRestored: boolean;
  update: (patch: Partial<WizardDraft>) => void;
  goToStep: (step: number) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

function loadDraft(): { draft: WizardDraft; restored: boolean } {
  const stored = kvStorage.getJson<WizardDraft>(StorageKeys.wizardDraft);
  if (!stored?.updatedAt) return { draft: EMPTY_DRAFT, restored: false };

  const age = Date.now() - new Date(stored.updatedAt).getTime();
  if (Number.isNaN(age) || age > DRAFT_TTL_MS) {
    kvStorage.remove(StorageKeys.wizardDraft);
    return { draft: EMPTY_DRAFT, restored: false };
  }

  // A draft that never got past the first field is not worth announcing.
  const meaningful = Boolean(stored.companyName || stored.ownerName || stored.businessTypeId);
  return { draft: stored, restored: meaningful };
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const initial = useRef(loadDraft());
  const [draft, setDraft] = useState<WizardDraft>(initial.current.draft);
  const [wasRestored, setWasRestored] = useState(initial.current.restored);

  const persist = useCallback((next: WizardDraft) => {
    setDraft(next);
    kvStorage.setJson(StorageKeys.wizardDraft, next);
  }, []);

  const update = useCallback(
    (patch: Partial<WizardDraft>) => {
      setWasRestored(false);
      setDraft((current) => {
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
        kvStorage.setJson(StorageKeys.wizardDraft, next);
        return next;
      });
    },
    [],
  );

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.min(Math.max(step, 1), TOTAL_STEPS);
      update({ step: clamped });
    },
    [update],
  );

  const next = useCallback(() => goToStep(draft.step + 1), [goToStep, draft.step]);
  const back = useCallback(() => goToStep(draft.step - 1), [goToStep, draft.step]);

  const reset = useCallback(() => {
    kvStorage.remove(StorageKeys.wizardDraft);
    setWasRestored(false);
    persist({ ...EMPTY_DRAFT, updatedAt: new Date().toISOString() });
  }, [persist]);

  const value = useMemo<WizardContextValue>(
    () => ({ draft, totalSteps: TOTAL_STEPS, wasRestored, update, goToStep, next, back, reset }),
    [draft, wasRestored, update, goToStep, next, back, reset],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used inside <WizardProvider>.');
  }
  return context;
}
