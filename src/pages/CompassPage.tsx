import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TeaCompass } from '../components/TeaCompass';
import type { CompassMode } from '../components/TeaCompass';

export default function CompassPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialEntryId = params.get('entry') ?? undefined;
  const initialMode = (params.get('tab') as CompassMode) ?? undefined;
  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-10 lg:h-[100dvh] lg:overflow-hidden">
      <TeaCompass onBack={() => navigate(-1)} initialEntryId={initialEntryId} initialMode={initialMode} />
    </div>
  );
}
