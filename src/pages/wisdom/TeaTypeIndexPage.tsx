import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTeaReferenceCatalogue } from '../../wisdom/reference/client';
import {
  AXIS_INDENT,
  FACT,
  HoldingRow,
  IndexList,
  MEASURE,
  PAGE,
  PageHead,
  ProseSkeleton,
  SPACE,
  SectionHead,
  WisdomSubNav,
} from './wisdomShared';

const TeaTypeIndexPage: React.FC = () => {
  const { catalogue, isLoading, isError } = useTeaReferenceCatalogue();

  return (
    <article className={PAGE}>
      <Helmet>
        <title>Tea Types · The Wisdom Base · Teajia</title>
        <meta name="description" content="Tea families and the sellable tea types they contain, connected to Teajia's public catalogue." />
      </Helmet>
      <WisdomSubNav active="types" />
      <div className="mt-7">
        <PageHead kind="Holding" title="Tea Types" note="Families first, then the tea identities they contain." />
      </div>

      {isLoading && !catalogue && <div className={`${SPACE.section} ${AXIS_INDENT}`}><ProseSkeleton /></div>}
      {isError && !catalogue && (
        <p role="status" className={`${FACT} ${MEASURE} ${AXIS_INDENT} ${SPACE.section}`}>
          The local cited preview is unavailable. The rest of the Wisdom Base is still ready to browse.
        </p>
      )}

      {catalogue && (
        <>
          <section className={SPACE.section}>
            <SectionHead label="Tea families" count={catalogue.families.length || undefined} />
            <IndexList>
              {catalogue.families.map(family => {
                const children = catalogue.types.filter(type => type.familyId === family.id);
                return (
                  <HoldingRow
                    key={family.id}
                    to={`/wisdom/family/${family.id}`}
                    name={family.name}
                    cells={[`${children.length} ${children.length === 1 ? 'type' : 'types'}`]}
                  />
                );
              })}
            </IndexList>
          </section>
          <section className={SPACE.section}>
            <SectionHead label="Tea types" count={catalogue.types.length || undefined} />
            <IndexList>
              {catalogue.types.map(type => {
                const family = catalogue.families.find(entry => entry.id === type.familyId);
                return (
                  <HoldingRow
                    key={type.id}
                    to={`/wisdom/type/${type.id}`}
                    name={type.name}
                    cells={[family?.name, `${type.productIds.length} ${type.productIds.length === 1 ? 'tea' : 'teas'}`]}
                  />
                );
              })}
            </IndexList>
          </section>
        </>
      )}
    </article>
  );
};

export default TeaTypeIndexPage;
