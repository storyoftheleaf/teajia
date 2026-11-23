import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePrivateQueryScope } from '../../hooks/usePrivateQueryScope';
import { canReview, guidePath } from './data';

export function OwnerWisdomLink() {
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const allowed = useQuery({
    queryKey: ['yixing-access', ...scope.key], enabled: scope.ready, retry: false, gcTime: 0,
    queryFn: ({ signal }) => canReview({ accountId, userId }, signal),
  });
  return scope.ready && allowed.data && !allowed.isError
    ? <Link className="btn-quiet btn-sm mx-4 mt-2" to={guidePath()}>Yixing teapot Wisdom</Link>
    : null;
}
