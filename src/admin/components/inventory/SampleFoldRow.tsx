import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../../types';
import { useTeaCompassStore } from '../../../lib/teaCompassStore';
import { SampleDecideBar } from './phone/SampleDecide';
import { linkProductToCurate } from './phone/sampleDecisions';
import { linkedEntryId, productSampleHolding } from './sampleRows';

/**
 * The sampling a Stock row folds out while its tea is a sample: how much he
 * likes it, then Taste, Reject or Want. The row above stays an ordinary Stock
 * row (Adrian, 2026-10-11: "it looks no different above it, but beneath it you
 * have the interactive sampling"). A shelf product bought to sample gets its
 * Curate record the first time it is rated, rejected or wanted.
 */
export const SampleFoldRow: React.FC<{ product: Product; colSpan: number }> = ({ product, colSpan }) => {
  const navigate = useNavigate();
  const entries = useTeaCompassStore((s) => s.entries);
  const entryId = linkedEntryId(product, entries);
  // Until a shelf product has a Curate record, the bar reads the product's own
  // figures; once it has one, the live record answers.
  const holding = productSampleHolding(product, entryId);
  const resolveId = async () => entryId ?? linkProductToCurate(product);
  const openCurate = async () => navigate(`/admin/compass?entry=${encodeURIComponent(await resolveId())}`);
  return (
    <tr data-testid="sample-fold" className="border-b border-tea-border">
      <td colSpan={colSpan} className="px-3 pb-2 pt-0">
        <div className="max-w-[520px]"><SampleDecideBar holding={holding} onTaste={() => void openCurate()} compact resolveId={resolveId} /></div>
      </td>
    </tr>
  );
};
