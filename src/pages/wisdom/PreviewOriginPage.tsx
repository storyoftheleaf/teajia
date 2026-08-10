import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTeaReferenceCatalogue } from '../../wisdom/reference/client';
import {
  AXIS_INDENT,
  FACT,
  Fact,
  HoldingNotFound,
  HoldingRow,
  IndexList,
  MEASURE,
  PREVIEW_PAGE,
  PageHead,
  ProseSkeleton,
  QUIET_LINK,
  SPACE,
  SectionHead,
  WisdomSubNav,
} from './wisdomShared';
import ReferenceFactSections from './ReferenceFactSections';
import { previewPlaceLevel } from './previewOriginMetadata';
import { mapSearchLink } from './mapLinks';

const PreviewOriginPage: React.FC<{ id: string }> = ({ id }) => {
  const { catalogue, products, isLoading, isError } = useTeaReferenceCatalogue();
  const origin = catalogue?.origins.find(entry => entry.id === id);
  const ancestors = [] as NonNullable<typeof origin>[];
  if (origin?.parentId && catalogue) {
    const seen = new Set([origin.id]);
    let current = origin;
    while (current.parentId && !seen.has(current.parentId)) {
      const parent = catalogue.origins.find(entry => entry.id === current.parentId);
      if (!parent) break;
      seen.add(parent.id);
      ancestors.unshift(parent);
      current = parent;
    }
  }
  const children = origin
    ? catalogue?.origins.filter(entry => entry.parentId === origin.id) ?? []
    : [];
  const representedTypes = origin && catalogue
    ? catalogue.types.filter(type => type.productIds.some(productId => origin.productIds.includes(productId)))
    : [];
  const originProducts = origin
    ? products.filter(product => origin.productIds.includes(product.id))
    : [];
  const recordedCountries = [...new Set(originProducts.map(product => product.originCountry.trim()).filter(Boolean))];
  const map = origin && recordedCountries.length === 1
    ? mapSearchLink([origin.name, ...[...ancestors].reverse().map(ancestor => ancestor.name)], recordedCountries[0])
    : null;

  if (catalogue && !origin) {
    return (
      <HoldingNotFound
        section="regions"
        heading="Not a place we hold"
        backTo="/wisdom/regions"
        backLabel="All origins"
        subject="A growing place that is missing"
      />
    );
  }

  return (
    <article className={PREVIEW_PAGE}>
      <Helmet><title>{origin ? `${origin.name} · Origins · Teajia` : 'Cited origin · Teajia'}</title></Helmet>
      <WisdomSubNav active="regions" />
      <div className="mt-7">
        <PageHead kind="Cited origin" title={origin?.name ?? 'Cited origin'} />
      </div>

      {isLoading && !catalogue && (
        <div className={`${SPACE.section} ${AXIS_INDENT}`}><ProseSkeleton /></div>
      )}
      {isError && !catalogue && (
        <div role="status" className={`${FACT} ${MEASURE} ${AXIS_INDENT} ${SPACE.section}`}>
          This cited origin could not be loaded.{' '}
          <Link to="/wisdom/regions" className={`${QUIET_LINK} tap-target`}>Return to Origins</Link>.
        </div>
      )}

      {origin && (
        <>
          <div className="mt-8">
            <Fact label="Level">{previewPlaceLevel(origin.level).singular}</Fact>
            {origin.parentId && ancestors.length > 0 && (
              <Fact label="Origin path">
                {ancestors.map((ancestor, index) => (
                  <React.Fragment key={ancestor.id}>
                    {index > 0 && <span aria-hidden="true"> › </span>}
                    <Link to={`/wisdom/region/${ancestor.id}`} className={`${QUIET_LINK} tap-target`}>
                      {ancestor.name}
                    </Link>
                  </React.Fragment>
                ))}
              </Fact>
            )}
            {map && (
              <p className={`${FACT} ${AXIS_INDENT} mt-1.5`}>
                <a href={map.url} target="_blank" rel="noreferrer" className={`${QUIET_LINK} tap-target`}>
                  {map.label}
                </a>
              </p>
            )}
          </div>

          {children.length > 0 && (
            <div className={SPACE.section}>
              <SectionHead label="Places within this origin" count={children.length} />
              <IndexList>
                {children.map(child => (
                  <HoldingRow
                    key={child.id}
                    to={`/wisdom/region/${child.id}`}
                    name={child.name}
                    cells={[previewPlaceLevel(child.level).singular]}
                  />
                ))}
              </IndexList>
            </div>
          )}

          {representedTypes.length > 0 && (
            <section className={SPACE.section} aria-labelledby="origin-types-heading">
              <SectionHead
                id="origin-types-heading"
                label="Tea types represented by available teas"
                count={representedTypes.length}
              />
              <IndexList>
                {representedTypes.map(type => (
                  <HoldingRow
                    key={type.id}
                    to={`/wisdom/type/${type.id}`}
                    name={type.name}
                  />
                ))}
              </IndexList>
            </section>
          )}

          <ReferenceFactSections
            facts={origin.facts}
            sources={catalogue?.sources ?? []}
            products={products.filter(product => origin.productIds.includes(product.id))}
            reportIdentity={`Origin: ${origin.name}`}
          />
        </>
      )}
    </article>
  );
};

export default PreviewOriginPage;
