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

const TeaFamilyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { catalogue, products, isLoading, isError } = useTeaReferenceCatalogue();
  const family = catalogue?.families.find(entry => entry.id === id);
  const types = family ? catalogue?.types.filter(type => type.familyId === family.id) ?? [] : [];

  if (catalogue && !family) {
    return (
      <HoldingNotFound
        section="types"
        heading="Tea family not found"
        backTo="/wisdom/types"
        backLabel="All tea types"
        subject="A tea family that is missing"
      />
    );
  }

  return (
    <article className={PREVIEW_PAGE}>
      <Helmet><title>{family ? `${family.name} · Tea Types · Teajia` : 'Tea family · Teajia'}</title></Helmet>
      <WisdomSubNav active="types" />
      <div className="mt-7">
        <PageHead kind="Tea family" title={family?.name ?? 'Tea family'} />
      </div>
      {isLoading && !catalogue && <div className={`${SPACE.section} ${AXIS_INDENT}`}><ProseSkeleton /></div>}
      {isError && !catalogue && (
        <p role="status" className={`${FACT} ${MEASURE} ${AXIS_INDENT} ${SPACE.section}`}>
          This cited page could not be loaded. The rest of the Wisdom Base remains available.
        </p>
      )}
      {family && (
        <>
          <div className="mt-8">
            <Fact label="Holding"><Link to="/wisdom/types" className={`${QUIET_LINK} tap-target`}>Tea Types</Link></Fact>
          </div>
          <section className={SPACE.section}>
            <SectionHead label="Types in this family" count={types.length || undefined} />
            <IndexList>
              {types.map(type => (
                <HoldingRow
                  key={type.id}
                  to={`/wisdom/type/${type.id}`}
                  name={type.name}
                  cells={[`${type.productIds.length} ${type.productIds.length === 1 ? 'tea' : 'teas'}`]}
                />
              ))}
            </IndexList>
          </section>
          <ReferenceFactSections
            facts={family.facts}
            sources={catalogue?.sources ?? []}
            products={products.filter(product => family.productIds.includes(product.id))}
            reportIdentity={`Tea family: ${family.name}`}
            referencePage={catalogue?.pages.find(page => page.kind === 'tea_family' && page.id === family.id)}
          />
        </>
      )}
    </article>
  );
};

export default TeaFamilyPage;
