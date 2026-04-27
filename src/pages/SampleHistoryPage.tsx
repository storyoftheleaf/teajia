import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';

export default function SampleHistoryPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center animate-[fadeIn_0.5s_ease-out]">
      <Icons.Leaf className="w-10 h-10 text-tea-gold/40 mb-4" />
      <h1 className="font-serif text-2xl text-tea-text mb-2">Your Samples</h1>
      <p className="text-sm text-tea-text-sec mb-6 max-w-xs">
        Teas sent to you for exploration. Once you've tried them, add a journal entry to capture your impressions.
      </p>
      <button
        onClick={() => navigate(-1)}
        className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-gold transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}
