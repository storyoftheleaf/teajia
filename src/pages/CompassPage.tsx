import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TeaCompass } from '../components/TeaCompass';

export default function CompassPage() {
  const navigate = useNavigate();
  return (
    <div
      className="-mx-4 md:-mx-6 lg:-mx-10"
      style={{ height: 'calc(100dvh - env(safe-area-inset-top, 0px) - 44px - env(safe-area-inset-bottom, 0px))' }}
    >
      <TeaCompass onBack={() => navigate(-1)} />
    </div>
  );
}
