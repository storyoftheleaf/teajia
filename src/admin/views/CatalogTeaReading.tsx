import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { API_URL, authedFetch } from '../../lib/api';
import { TeaDecisions, type TeaIntakeEntry } from './TeaDecisions';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';

export default function CatalogTeaReading() {
  const { groupId } = useParams();
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const query = useQuery<TeaIntakeEntry[]>({
    queryKey: ['private-tea-review-intake', ...scope.key],
    enabled: scope.ready, retry: false,
    queryFn: ({ signal }) => authedFetch(API_URL + '/api/admin/catalog-review/teas', {
      expectedAuth: { accountId, userId }, signal, cache: 'no-store', reportIncident: false,
    }),
  });
  if (!scope.ready || query.isPending) return <p className="p-4" role="status">Opening tea decisions…</p>;
  if (!Array.isArray(query.data)) return <p className="p-4" role="status">Tea review unavailable for this account.</p>;
  return <TeaDecisions key={JSON.stringify(scope.key)} entries={query.data} groupId={groupId} />;
}
