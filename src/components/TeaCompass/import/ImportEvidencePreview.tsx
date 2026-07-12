import React from 'react';
import { FileText, Image } from 'lucide-react';
import type { ImportEvidence } from './importTypes';

export const ImportEvidencePreview: React.FC<{ evidence: ImportEvidence[] }> = ({ evidence }) => {
  if (!evidence.length) return null;
  return (
    <ul className="grid gap-2" aria-label="Attached evidence">
      {evidence.map(item => (
        <li key={item.id} className="flex min-w-0 items-center gap-2 rounded-md border border-tea-border bg-tea-surface px-3 py-2 text-ui-12 text-tea-text-sec">
          {item.kind === 'photo' ? <Image size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
          <span className="truncate">{item.file.name}</span>
        </li>
      ))}
    </ul>
  );
};

