import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Inbox } from 'lucide-react';

export default function SampleHistoryPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
        aria-label="Back"
      >
        <ChevronLeft size={14} />
        <span className="text-ui-12 uppercase tracking-[0.15em]">Back</span>
      </button>

      <h1 className="h2">Your Samples</h1>
      <p className="label-caps text-tea-text-dim mt-1">All Samples</p>

      <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
        <Inbox size={28} strokeWidth={1.25} className="text-tea-text-dim" />
        <h3 className="font-display text-ui-17 text-tea-text mt-4">No samples yet</h3>
        <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
          Teas sent to you for exploration. Once you have tried them, add a journal entry to capture your impressions.
        </p>
      </div>
    </div>
  );
}
