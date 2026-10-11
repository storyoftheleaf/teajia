import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../src/styles/tailwind.css';
import '../../src/styles/card-utilities.css';
import { SupplierSheet } from '../../src/components/shared/SupplierSheet';

// Test-only. ?id=<vendor id>&name=<name shown>. The renamed name lands in
// window.__renamed so the spec can read what onRenamed was handed.
const params = new URLSearchParams(location.search);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const Harness: React.FC = () => {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(params.get('name') ?? 'Master Bo');
  return (
    <MemoryRouter>
      <p data-testid="list-name">{name}</p>
      <button type="button" onClick={() => setOpen(true)}>Open sheet</button>
      <SupplierSheet
        vendorId={params.get('id')}
        vendorName={name}
        open={open}
        onClose={() => setOpen(false)}
        onRenamed={(n) => { (window as any).__renamed = n; setName(n); }}
      />
    </MemoryRouter>
  );
};

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>,
);
