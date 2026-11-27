// The ways on from one table's page: its recap, the Tea Table, the card to print (review U1-2, U1-14).
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { tableCardOpen } from '../../lib/tableCard';
import { teaTableOpen } from '../../lib/teaTable';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { tableLinks, type HostTablePartProps } from './hostTableParts';

export function HostTableLinks({ detail, only }: HostTablePartProps & { only?: ReadonlyArray<'recap' | 'tea-table' | 'card'> }) {
  const { isAdmin } = useAuth();
  const links = tableLinks(detail.table, { isAdmin, teaTable: teaTableOpen(), card: tableCardOpen() })
    .filter(link => !only || only.includes(link.key));
  if (links.length === 0) return null;
  return (
    <ul className="space-y-1" aria-label="More for this table" data-host-links>
      {links.map(link => (
        <li key={link.key}><Link to={link.to} className={`${TYPOGRAPHY_CLASSES.link} tap-target inline-flex items-center`}>{link.label}</Link></li>
      ))}
    </ul>
  );
}
