import React from 'react';
import { useTeaReferenceCatalogue } from '../../wisdom/reference/client';
import type { PublicTeaOrigin } from '../../wisdom/reference/types';
import {
  AXIS_INDENT,
  FACT,
  HoldingRow,
  IndexList,
  MEASURE,
  SPACE,
  SectionHead,
} from './wisdomShared';
import { PREVIEW_PLACE_LEVELS } from './previewOriginMetadata';

const OriginRows: React.FC<{ origins: readonly PublicTeaOrigin[] }> = ({ origins }) => (
  <IndexList>
    {origins.map(origin => (
      <HoldingRow
        key={origin.id}
        to={`/wisdom/region/${origin.id}`}
        name={origin.name}
        cells={[`${origin.productIds.length} ${origin.productIds.length === 1 ? 'cited tea' : 'cited teas'}`]}
      />
    ))}
  </IndexList>
);

const PreviewOriginIndexSection: React.FC = () => {
  const { catalogue, isLoading, isError } = useTeaReferenceCatalogue();

  if (isLoading && !catalogue) return null;
  if (isError && !catalogue) {
    return (
      <p role="status" className={`${FACT} ${MEASURE} ${AXIS_INDENT} mt-8`}>
        The local cited origins preview is unavailable. The published growing regions remain ready to browse.
      </p>
    );
  }
  if (!catalogue || catalogue.origins.length === 0) return null;

  return (
    <section aria-labelledby="preview-origin-heading" className={SPACE.section}>
      <SectionHead
        id="preview-origin-heading"
        label="Cited origins in this preview"
        count={catalogue.origins.length}
      />
      {PREVIEW_PLACE_LEVELS.map(group => {
        const origins = catalogue.origins.filter(origin => origin.level === group.level);
        if (origins.length === 0) return null;
        const headingId = `preview-origin-level-${group.level}`;
        return (
          <section key={group.level} aria-labelledby={headingId} className="mt-8 first:mt-0">
            <SectionHead id={headingId} headingLevel={3} label={group.plural} count={origins.length} />
            <OriginRows origins={origins} />
          </section>
        );
      })}
    </section>
  );
};

export default PreviewOriginIndexSection;
