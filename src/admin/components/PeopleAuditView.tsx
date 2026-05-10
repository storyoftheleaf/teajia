import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Link2, Loader2, RefreshCw, UserRoundCheck, Wand2 } from 'lucide-react';
import { api } from '../../lib/api';
import { CONTACT_RELATIONSHIP_TAXONOMY } from '../../lib/contactTaxonomy';
import { ContactRelationshipKind, Customer } from '../types';
import { useToast } from './Toast';

type AuditSuggestion = {
  id: string;
  action: 'add_relationship' | 'link_contributor';
  kind?: ContactRelationshipKind;
  customer_id?: string;
  customer_name?: string;
  contributor_id?: string;
  contributor_name?: string;
  reason: string;
  source_entity_type: string;
  source_entity_id: string;
  confidence: 'high' | 'medium';
};

type AdminContributor = {
  id: string;
  display_name: string;
  chinese_name?: string | null;
  role?: string | null;
  is_published?: number;
  contact_customer_id?: string | null;
  contact_name?: string | null;
};

const relationLabel = (kind?: ContactRelationshipKind) =>
  kind ? CONTACT_RELATIONSHIP_TAXONOMY[kind]?.shortLabel ?? kind : 'Link';

const PeopleAuditView: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [savingContributorId, setSavingContributorId] = useState<string | null>(null);

  const auditQuery = useQuery({
    queryKey: ['people-relationship-audit'],
    queryFn: () => api.people.getRelationshipAudit(),
    staleTime: 1000 * 60,
  });

  const contributorsQuery = useQuery({
    queryKey: ['admin-contributors'],
    queryFn: () => api.people.listAdminContributors(),
    staleTime: 1000 * 60 * 3,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'people-audit-options'],
    queryFn: () => api.customers.list(),
    staleTime: 1000 * 60 * 3,
  });

  const suggestions: AuditSuggestion[] = auditQuery.data?.suggestions ?? [];
  const relationshipSuggestions = suggestions.filter(s => s.action === 'add_relationship');
  const contributorLinkSuggestions = suggestions.filter(s => s.action === 'link_contributor');
  const contributors: AdminContributor[] = contributorsQuery.data?.contributors ?? [];
  const customers: Customer[] = customersQuery.data ?? [];

  const customerOptions = useMemo(
    () => customers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  );

  const applyMutation = useMutation({
    mutationFn: () => api.people.applyRelationshipAudit(),
    onSuccess: async (result: any) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['people-relationship-audit'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-contributors'] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
      ]);
      showToast(
        `Applied ${result.relationships_added ?? 0} relationship update${(result.relationships_added ?? 0) === 1 ? '' : 's'}.`,
        'success',
      );
    },
    onError: () => showToast('Could not apply the relationship audit.', 'error'),
  });

  const handleContributorContactChange = async (contributorId: string, customerId: string) => {
    setSavingContributorId(contributorId);
    try {
      await api.people.updateContributorContact(contributorId, customerId || null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-contributors'] }),
        queryClient.invalidateQueries({ queryKey: ['people-relationship-audit'] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
      ]);
      showToast(customerId ? 'Contributor linked to contact.' : 'Contributor contact link cleared.', 'success');
    } catch {
      showToast('Could not update contributor contact link.', 'error');
    } finally {
      setSavingContributorId(null);
    }
  };

  if (auditQuery.isLoading || contributorsQuery.isLoading || customersQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-tea-bg">
        <Loader2 size={22} className="animate-spin text-tea-text-sec" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-tea-bg pb-nav-gap">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-10 py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-ui-10 uppercase tracking-[0.16em] text-tea-text-sec mb-2">Owner relationship audit</p>
            <h2 className="text-2xl text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
              Keep the people layer honest
            </h2>
            <p className="text-sm text-tea-text-sec mt-2 max-w-2xl leading-relaxed">
              This checks where real product behavior implies a relationship that has not been made explicit yet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => auditQuery.refetch()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tea-border bg-tea-surface text-tea-text-sec hover:text-tea-text text-sm transition-colors"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={() => applyMutation.mutate()}
              disabled={suggestions.length === 0 || applyMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-tea-gold text-tea-bg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {applyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Apply suggestions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-tea-surface border border-tea-border rounded-lg p-4">
            <p className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec">Missing meaning</p>
            <p className="text-3xl font-serif text-tea-text mt-2">{relationshipSuggestions.length}</p>
          </div>
          <div className="bg-tea-surface border border-tea-border rounded-lg p-4">
            <p className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec">Contributor links</p>
            <p className="text-3xl font-serif text-tea-text mt-2">{contributorLinkSuggestions.length}</p>
          </div>
          <div className="bg-tea-surface border border-tea-border rounded-lg p-4">
            <p className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec">Contributors</p>
            <p className="text-3xl font-serif text-tea-text mt-2">{contributors.length}</p>
          </div>
        </div>

        <section className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-tea-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-tea-gold" />
              <h3 className="font-serif text-tea-text">Suggested relationship updates</h3>
            </div>
            <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec">{relationshipSuggestions.length}</span>
          </div>
          {relationshipSuggestions.length === 0 ? (
            <div className="p-5 text-sm text-tea-text-sec">No missing relationship meanings found.</div>
          ) : (
            <div className="divide-y divide-tea-border">
              {relationshipSuggestions.map(suggestion => (
                <div key={suggestion.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-tea-text">{suggestion.customer_name}</span>
                      <span className="text-ui-10 uppercase tracking-[0.12em] bg-tea-elevated text-tea-text-sec px-2 py-1 rounded-full">
                        {relationLabel(suggestion.kind)}
                      </span>
                    </div>
                    <p className="text-ui-11 text-tea-text-sec mt-1 leading-relaxed">{suggestion.reason}</p>
                  </div>
                  <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec shrink-0">
                    {suggestion.source_entity_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-tea-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 size={16} className="text-tea-gold" />
              <h3 className="font-serif text-tea-text">Contributor contact bridge</h3>
            </div>
            <span className="text-ui-10 uppercase tracking-[0.14em] text-tea-text-sec">{contributors.length}</span>
          </div>
          {contributors.length === 0 ? (
            <div className="p-5 text-sm text-tea-text-sec">No contributor profiles exist yet.</div>
          ) : (
            <div className="divide-y divide-tea-border">
              {contributors.map(contributor => (
                <div key={contributor.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-3 md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-tea-text">{contributor.display_name}</span>
                      {contributor.role && (
                        <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec">{contributor.role}</span>
                      )}
                    </div>
                    <p className="text-ui-11 text-tea-text-sec mt-1">
                      {contributor.contact_name ? `Linked to ${contributor.contact_name}` : 'No private contact link yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserRoundCheck size={14} className="text-tea-text-sec shrink-0" />
                    <select
                      value={contributor.contact_customer_id ?? ''}
                      onChange={e => handleContributorContactChange(contributor.id, e.target.value)}
                      disabled={savingContributorId === contributor.id}
                      className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text focus:outline-none focus:border-tea-gold/50"
                    >
                      <option value="">No linked contact</option>
                      {customerOptions.map(customer => (
                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                      ))}
                    </select>
                    {savingContributorId === contributor.id && <Loader2 size={14} className="animate-spin text-tea-text-sec shrink-0" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PeopleAuditView;
