import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { atlasAdminResponse } from '../lib/api';
import { ATLAS_ROOT } from './AtlasFrame';

/** "Add a source", shown only to the person the server lets add one (docs/TEA_ATLAS.md). */
export function AtlasAddSourceLink({ className = '' }: { className?: string }) {
  const [can, setCan] = useState(false);
  useEffect(() => {
    let live = true;
    atlasAdminResponse('can-manage').then(res => { if (live) setCan(res.ok); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!can) return null;
  return (
    <Link to={`${ATLAS_ROOT}/add`} className={`text-ui-14 text-tea-text-sec hover:text-tea-text transition-colors ${className}`}>
      Add a source
    </Link>
  );
}
