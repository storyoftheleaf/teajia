import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { api, type WisdomVerificationReceipt } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { fingerprintWisdomEntry } from '../../wisdom/verificationFingerprint';
import type { WisdomCitation, WisdomEntryKind, WisdomPotentialProfile } from '../../wisdom/types';
import { AXIS_INDENT, RULE_FULL, SPACE } from './wisdomShared';

export interface WisdomVerificationInput {
  entryKind: WisdomEntryKind;
  entryId: string;
  entry: unknown;
  citations: WisdomCitation[];
  potentialProfile: WisdomPotentialProfile | null;
  ready?: boolean;
}

export interface WisdomVerificationQueryData {
  currentHash: string;
  receipt: WisdomVerificationReceipt | null;
}

type WisdomVerificationApi = Pick<typeof api.wisdomVerifications, 'get' | 'put' | 'delete'>;
type VerificationState = 'empty' | 'verified' | 'changed';

function fingerprintInput(input: WisdomVerificationInput) {
  return {
    entry: input.entry,
    citations: input.citations,
    potentialProfile: input.potentialProfile,
  };
}

export function wisdomVerificationQueryKey(accountId: string, input: WisdomVerificationInput) {
  return [
    'wisdom-verification',
    accountId,
    input.entryKind,
    input.entryId,
    input.entry,
    input.citations,
    input.potentialProfile,
  ] as const;
}

export async function loadWisdomVerification(
  input: WisdomVerificationInput,
  client: WisdomVerificationApi = api.wisdomVerifications,
): Promise<WisdomVerificationQueryData> {
  const currentHash = await fingerprintWisdomEntry(fingerprintInput(input));
  const receipt = await client.get(input.entryKind, input.entryId);
  return { currentHash, receipt };
}

export async function saveWisdomVerification(
  input: WisdomVerificationInput,
  client: WisdomVerificationApi = api.wisdomVerifications,
): Promise<WisdomVerificationQueryData> {
  const currentHash = await fingerprintWisdomEntry(fingerprintInput(input));
  const receipt = await client.put(input.entryKind, input.entryId, currentHash);
  return { currentHash, receipt: { ...receipt, content_hash: currentHash } };
}

export async function undoWisdomVerification(
  input: Pick<WisdomVerificationInput, 'entryKind' | 'entryId'>,
  client: WisdomVerificationApi = api.wisdomVerifications,
) {
  return client.delete(input.entryKind, input.entryId);
}

function receiptState(data: WisdomVerificationQueryData | undefined): VerificationState {
  if (!data?.receipt) return 'empty';
  return data.receipt.content_hash === data.currentHash ? 'verified' : 'changed';
}

const STATE_LABEL: Record<VerificationState, string> = {
  empty: 'Verify this reference',
  verified: 'Reference verified',
  changed: 'Reference changed since verification',
};

const OwnerWisdomVerificationControl: React.FC<WisdomVerificationInput & { accountId: string }> = input => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState(false);
  const queryKey = wisdomVerificationQueryKey(input.accountId, input);
  const query = useQuery({
    queryKey,
    queryFn: () => loadWisdomVerification(input),
    enabled: input.ready !== false,
  });
  const save = useMutation({
    mutationFn: () => saveWisdomVerification(input),
    onSuccess: data => {
      queryClient.setQueryData(queryKey, data);
      setNotice(true);
    },
  });
  const undo = useMutation({
    mutationFn: () => undoWisdomVerification(input),
    onSuccess: () => {
      if (query.data) queryClient.setQueryData(queryKey, { ...query.data, receipt: null });
      setNotice(false);
    },
  });
  const state = receiptState(query.data);
  const label = STATE_LABEL[state];
  const pending = save.isPending || undo.isPending;

  return (
    <div data-wisdom-verification className={`${SPACE.section} ${RULE_FULL} pt-6`}>
      <div className={`${AXIS_INDENT} flex flex-wrap items-center gap-3`}>
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => save.mutate()}
          disabled={pending || !query.data?.currentHash}
          className="tap-target relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-tea-border text-tea-text-dim transition-colors hover:border-tea-gold/30 hover:text-tea-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2
            size={18}
            strokeWidth={state === 'verified' ? 2.5 : 1.5}
            className={state === 'verified' ? 'fill-tea-gold text-tea-bg' : state === 'changed' ? 'text-tea-text-sec' : undefined}
            aria-hidden="true"
          />
          {state === 'changed' && <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-tea-gold" />}
        </button>

        {notice && (
          <p role="status" className="flex flex-wrap items-center gap-3 text-ui-11 text-tea-text-sec">
            Reference verified.
            <button
              type="button"
              onClick={() => undo.mutate()}
              disabled={pending}
              className="tap-target text-ui-11 text-tea-gold transition-colors hover:text-tea-gold-lt disabled:opacity-50"
            >
              Undo
            </button>
          </p>
        )}
        {(query.isError || save.isError || undo.isError) && (
          <p role="alert" className="text-ui-11 text-tea-text-sec">Could not update reference verification.</p>
        )}
      </div>
    </div>
  );
};

export const WisdomVerificationControl: React.FC<WisdomVerificationInput> = input => {
  const platformRole = useAppStore(state => state.platformRole);
  const activeAccountId = useAppStore(state => state.activeAccountId);
  if (platformRole !== 'platform_owner' || !activeAccountId) return null;
  return <OwnerWisdomVerificationControl {...input} accountId={activeAccountId} />;
};

export default WisdomVerificationControl;
