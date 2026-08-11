import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
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

const TeaTypePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { catalogue, products, isLoading, isError } = useTeaReferenceCatalogue();
  const type = catalogue?.types.find(entry => entry.id === id);
  const family = type ? catalogue?.families.find(entry => entry.id === type.familyId) : undefined;
  const connectedOrigins = type && catalogue
    ? catalogue.origins.filter(origin => origin.productIds.some(productId => type.productIds.includes(productId)))
    : [];
  const displayedOrigins = connectedOrigins.filter(origin => (
    !connectedOrigins.some(candidate => candidate.parentId === origin.id)
  ));

  if (catalogue && !type) {
    return (
      <HoldingNotFound
        section="types"
        heading="Tea type not found"
        backTo="/wisdom/types"
        backLabel="All tea types"
        subject="A tea type that is missing"
      />
    );
  }

  return (
    <article className={PREVIEW_PAGE}>
      <Helmet><title>{type ? `${type.name} · Tea Types · Teajia` : 'Tea type · Teajia'}</title></Helmet>
      <WisdomSubNav active="types" />
      <div className="mt-7">
        <PageHead kind="Tea type" title={type?.name ?? 'Tea type'} />
      </div>
      {isLoading && !catalogue && <div className={`${SPACE.section} ${AXIS_INDENT}`}><ProseSkeleton /></div>}
      {isError && !catalogue && (
        <p role="status" className={`${FACT} ${MEASURE} ${AXIS_INDENT} ${SPACE.section}`}>
          This cited page could not be loaded. The rest of the Wisdom Base remains available.
        </p>
      )}
      {type && (
        <>
          <div className="mt-8">
            <Fact label="Family">
              {family ? <Link to={`/wisdom/family/${family.id}`} className={`${QUIET_LINK} tap-target`}>{family.name}</Link> : null}
            </Fact>
          </div>
          {displayedOrigins.length > 0 && (
            <section className={SPACE.section} aria-labelledby="type-origins-heading">
              <SectionHead
                id="type-origins-heading"
                label="Origins represented by available teas"
                count={displayedOrigins.length}
              />
              <IndexList>
                {displayedOrigins.map(origin => (
                  <HoldingRow
                    key={origin.id}
                    to={`/wisdom/region/${origin.id}`}
                    name={origin.name}
                    cells={[previewPlaceLevel(origin.level).singular]}
                  />
                ))}
              </IndexList>
            </section>
          )}
          <ReferenceFactSections
            facts={type.facts}
            sources={catalogue?.sources ?? []}
            products={products.filter(product => type.productIds.includes(product.id))}
            reportIdentity={`Tea type: ${type.name}`}
            referencePage={catalogue?.pages.find(page => page.kind === 'tea_type' && page.id === type.id)}
          />
        </>
      )}
    </article>
  );
};

export default TeaTypePage;
