export type TeaReviewView = 'intake' | 'editorial' | 'holds' | 'histories';
export type TeaReviewRef = { view: TeaReviewView; id: string };
export type TeaIdentityFinding = { text: string; resolved: boolean };

export type TeaConnection = {
  revision: string;
  stockId: string | null;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  canAssignVendor: boolean;
  finding: TeaIdentityFinding | null;
  version: number;
};

export type TeaConnectionSnapshot = Pick<TeaConnection, 'revision' | 'stockId' | 'vendorId' | 'version'>;
export type TeaConnectionEdit = { expected: TeaConnectionSnapshot } & (
  { action: 'vendor'; vendorId: string | null } |
  ({ action: 'finding' } & TeaIdentityFinding)
);
