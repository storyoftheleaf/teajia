import React, { useReducer, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '../../components/shared/BottomSheet';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import {
  TEA_REFERENCE_ISSUE_CATEGORIES,
  type CreateTeaReferenceIssueInput,
  type TeaReferenceFlagPage,
  type TeaReferenceIssueCategory,
  type TeaReferencePageSection,
} from '../../wisdom/reference/issues';
import { CELL_CLASS, QUIET_LINK } from './wisdomShared';

export { TEA_REFERENCE_ISSUE_CATEGORIES };

export interface FlagIssueState {
  category: TeaReferenceIssueCategory;
  sectionKey: string;
  note: string;
  error: string;
  outcome: 'created' | 'duplicate' | null;
}

export type FlagIssueAction =
  | { type: 'category'; value: TeaReferenceIssueCategory }
  | { type: 'section'; value: string }
  | { type: 'note'; value: string }
  | { type: 'failed'; message: string }
  | { type: 'succeeded'; duplicate: boolean };

export function createInitialFlagIssueState(page: TeaReferenceFlagPage): FlagIssueState {
  return {
    category: TEA_REFERENCE_ISSUE_CATEGORIES[0].id,
    sectionKey: page.sections[0]?.key ?? '',
    note: '',
    error: '',
    outcome: null,
  };
}

export function reduceFlagIssueState(state: FlagIssueState, action: FlagIssueAction): FlagIssueState {
  if (action.type === 'category') return { ...state, category: action.value, error: '', outcome: null };
  if (action.type === 'section') return { ...state, sectionKey: action.value, error: '', outcome: null };
  if (action.type === 'note') return { ...state, note: action.value, error: '', outcome: null };
  if (action.type === 'failed') return { ...state, error: action.message, outcome: null };
  return { ...state, error: '', outcome: action.duplicate ? 'duplicate' : 'created' };
}

export function selectedFlagSection(
  page: TeaReferenceFlagPage,
  sectionKey: string,
): TeaReferencePageSection | undefined {
  return page.sections.find(section => section.key === sectionKey);
}

export function flagIssueSubmission(
  page: TeaReferenceFlagPage,
  state: FlagIssueState,
): CreateTeaReferenceIssueInput {
  return {
    page_id: page.id,
    section_key: state.sectionKey,
    category: state.category,
    note: state.note.trim(),
  };
}

export function canShowReferenceIssueFlag(
  isSessionReady: boolean,
  hasAuthenticatedUser: boolean,
  platformRole: unknown,
): boolean {
  return isSessionReady && hasAuthenticatedUser && platformRole === 'platform_owner';
}

export const FlagReferenceIssueAction: React.FC<{
  page: TeaReferenceFlagPage;
  onOpen: () => void;
}> = ({ page, onOpen }) => (
  <button
    type="button"
    aria-label={`Flag ${page.label} for revision`}
    onClick={onOpen}
    className={`tap-target ${CELL_CLASS} ${QUIET_LINK}`}
  >
    Flag for revision
  </button>
);

interface FlagReferenceIssueFormProps {
  page: TeaReferenceFlagPage;
  state: FlagIssueState;
  isPending: boolean;
  onCategory: (category: TeaReferenceIssueCategory) => void;
  onSection: (sectionKey: string) => void;
  onNote: (note: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const FlagReferenceIssueForm: React.FC<FlagReferenceIssueFormProps> = ({
  page,
  state,
  isPending,
  onCategory,
  onSection,
  onNote,
  onCancel,
  onSubmit,
}) => {
  const selectedSection = selectedFlagSection(page, state.sectionKey);
  const outcomeMessage = state.outcome === 'duplicate'
    ? 'This exact revision flag is already open.'
    : state.outcome === 'created'
      ? 'Revision flag added to Reference issues.'
      : null;

  return (
    <form className="space-y-5 px-2 pt-2" onSubmit={onSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block space-y-2">
          <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Issue category</span>
          <select
            className="input-field min-h-11 w-full"
            value={state.category}
            onChange={event => onCategory(event.target.value as TeaReferenceIssueCategory)}
            disabled={isPending}
          >
            {TEA_REFERENCE_ISSUE_CATEGORIES.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Affected section</span>
          <select
            className="input-field min-h-11 w-full"
            value={state.sectionKey}
            onChange={event => onSection(event.target.value)}
            disabled={isPending}
          >
            {page.sections.map(section => (
              <option key={section.key} value={section.key}>{section.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Current section text</p>
        <div className="border-l-2 border-tea-border pl-4">
          <p className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{selectedSection?.label}</p>
          <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 whitespace-pre-wrap text-tea-text-sec`}>
            {selectedSection?.text}
          </p>
        </div>
      </div>

      <label className="block space-y-2">
        <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Your note</span>
        <textarea
          required
          rows={4}
          className="input-field min-h-11 w-full resize-y"
          value={state.note}
          onChange={event => onNote(event.target.value)}
          disabled={isPending}
          placeholder="What should the next revision check?"
        />
      </label>

      {state.error && (
        <p role="alert" className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>{state.error}</p>
      )}
      {outcomeMessage && (
        <p role="status" className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-gold`}>{outcomeMessage}</p>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-tea-border pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className={`${TYPOGRAPHY_CLASSES.link} min-h-11 px-2 text-tea-text-sec transition-colors hover:text-tea-text disabled:opacity-50`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || Boolean(state.outcome)}
          className="cta-solid min-h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Flagging…' : 'Flag for revision'}
        </button>
      </div>
    </form>
  );
};

const FlagReferenceIssueSheetContent: React.FC<{
  page: TeaReferenceFlagPage;
  onCancel: () => void;
}> = ({ page, onCancel }) => {
  const [state, dispatch] = useReducer(reduceFlagIssueState, page, createInitialFlagIssueState);
  const queryClient = useQueryClient();
  const createIssue = useMutation({
    mutationFn: () => api.teaReferenceIssues.create(flagIssueSubmission(page, state)),
    onSuccess: response => {
      dispatch({ type: 'succeeded', duplicate: response.duplicate });
      void queryClient.invalidateQueries({ queryKey: ['tea-reference-issues'] });
    },
    onError: () => dispatch({ type: 'failed', message: 'Could not flag this section. Try again.' }),
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state.sectionKey || !state.note.trim()) {
      dispatch({ type: 'failed', message: 'Choose a section and add a note.' });
      return;
    }
    createIssue.mutate();
  };

  return (
    <FlagReferenceIssueForm
      page={page}
      state={state}
      isPending={createIssue.isPending}
      onCategory={category => dispatch({ type: 'category', value: category })}
      onSection={sectionKey => dispatch({ type: 'section', value: sectionKey })}
      onNote={note => dispatch({ type: 'note', value: note })}
      onCancel={onCancel}
      onSubmit={submit}
    />
  );
};

export const FlagReferenceIssueSheet: React.FC<{
  page: TeaReferenceFlagPage;
}> = ({ page }) => {
  const [open, setOpen] = useState(false);
  const storedIsPlatformOwner = useAppStore(state => (
    canShowReferenceIssueFlag(state.isSessionReady, Boolean(state.authUser), state.platformRole)
  ));

  if (!storedIsPlatformOwner) return null;

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  return (
    <>
      <FlagReferenceIssueAction page={page} onOpen={() => changeOpen(true)} />
      <BottomSheet
        open={open}
        onOpenChange={changeOpen}
        title="Flag for revision"
        description={page.label}
        large
      >
        {open && <FlagReferenceIssueSheetContent page={page} onCancel={() => changeOpen(false)} />}
      </BottomSheet>
    </>
  );
};

export default FlagReferenceIssueSheet;
