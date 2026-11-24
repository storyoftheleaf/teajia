export type TeaReviewView = 'intake' | 'editorial' | 'holds' | 'histories';
export type TeaReviewRef = { view: TeaReviewView; id: string };
export type TeaIdentityFinding = { text: string; resolved: boolean };

export type TeaIntakePage = {
  id: string;
  title: string;
  status: string;
  introduction: string;
  evidence: string;
  nextCheck: string;
  packageOnly: boolean;
  photos: string[];
  facts: { label: string; value: string }[];
  stockId?: string;
  stockCandidateIds?: string[];
  comparisonFacts?: { label: string; value: string }[];
};

export type TeaStockRecord = {
  id: string;
  name: string;
  chineseName: string | null;
  year: number | null;
  form: string | null;
  listingPublic: boolean;
  listingReviewable: boolean;
};

export type TeaReviewProgress = {
  matchedIntake: string[];
  resolvedHolds: string[];
};

export type TeaConnection = {
  revision: string;
  stockId: string | null;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  canAssignVendor: boolean;
  stock?: TeaStockRecord;
  intakeVendor?: { id: string; name: string };
  matchEvidence?: string;
  finding: TeaIdentityFinding | null;
  version: number;
};

export type TeaConnectionSnapshot = Pick<TeaConnection, 'revision' | 'stockId' | 'vendorId' | 'version'>;
export type TeaConnectionEdit = { expected: TeaConnectionSnapshot } & (
  { action: 'vendor'; vendorId: string | null } |
  { action: 'match'; stockId: string; evidence: string } |
  { action: 'clear-match' } |
  ({ action: 'finding' } & TeaIdentityFinding)
);
