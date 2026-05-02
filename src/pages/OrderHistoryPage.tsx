import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/Icons';

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center animate-[fadeIn_0.5s_ease-out]">
      <Icons.Clock className="w-10 h-10 text-tea-gold/40 mb-4" />
      <h1 className="font-serif text-2xl text-tea-text mb-2">Order History</h1>
      <p className="text-sm text-tea-text-sec mb-6 max-w-xs">
        Your past purchases will appear here. Every order starts a conversation — check WhatsApp for updates.
      </p>
      <button
        onClick={() => navigate(-1)}
        className="text-ui-10 uppercase tracking-display text-tea-text-sec hover:text-tea-gold transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}
