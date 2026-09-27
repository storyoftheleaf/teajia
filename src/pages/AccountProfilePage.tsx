import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Circle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { ProfileEditor } from '../components/profile/ProfileEditor';
import { ProfileFavoritesEditor } from '../components/profile/ProfileFavoritesEditor';
import { PaymentMethodsEditor } from '../components/profile/PaymentMethodsEditor';
import { PayAccessPanel } from '../components/profile/PayAccessPanel';
import { ProfileShareLinks } from '../components/profile/ProfileShareLinks';
import { canManageHostedMasterSelection, canStartProfileDraft, primaryTeaMasterAccount, profileReadiness } from '../components/profile/profileDomain';
import type { FavoriteWrite, PaymentMethodWrite, SelfProfileUpdate } from '../components/profile/types';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { selectHasBundle, useAppStore } from '../lib/store';

export default function AccountProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const memberships = useAppStore(state => state.memberships);
  const activeAccountId = useAppStore(state => state.activeAccountId);
  const platformRole = useAppStore(state => state.platformRole);
  const accessState = { memberships, activeAccountId, platformRole };
  const canManageStock = auth.isAdmin || selectHasBundle(accessState, 'stock');
  const canManageWriting = auth.isAdmin || selectHasBundle(accessState, 'publish');
  const profileQuery = useQuery({ queryKey: ['profile', 'self'], queryFn: api.profile.getSelf, enabled: auth.isAuthenticated });
  const favoritesQuery = useQuery({ queryKey: ['profile', 'favorites'], queryFn: api.profile.listFavorites, enabled: auth.isAuthenticated && Boolean(profileQuery.data?.profile) });
  const paymentsQuery = useQuery({ queryKey: ['profile', 'payment-methods'], queryFn: api.profile.listPaymentMethods, enabled: auth.isAuthenticated && Boolean(profileQuery.data?.profile) });

  const refreshProfile = () => queryClient.invalidateQueries({ queryKey: ['profile'] });
  const updateProfile = useMutation({ mutationFn: (value: SelfProfileUpdate & { id?: string }) => api.profile.updateSelf(value), onSuccess: refreshProfile });

  if (!auth.isAuthenticated && auth.isSessionReady) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-12 pb-nav-gap md:px-6">
        <p className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec`}>Sign in to prepare your Tea Master profile.</p>
        <button type="button" onClick={() => navigate('/signin')} className="cta-solid tap-target mt-5 rounded-md px-5 py-2.5 text-ui-13">Sign in</button>
      </main>
    );
  }

  if (profileQuery.isLoading || !auth.isSessionReady) return <ProfileLoading />;
  if (profileQuery.isError) return <ProfileError message={profileQuery.error instanceof Error ? profileQuery.error.message : 'The profile could not be loaded.'} onRetry={() => profileQuery.refetch()} />;

  const profile = profileQuery.data?.profile ?? null;
  const publicFavoriteCount = favoritesQuery.data?.favorites.filter(item => item.is_public && item.tea.is_public).length ?? 0;
  const publicPaymentCount = paymentsQuery.data?.methods.filter(item => item.is_published).length ?? 0;
  const readiness = profile ? profileReadiness(profile, { publicFavorites: publicFavoriteCount, paymentMethods: publicPaymentCount }) : [];
  const primaryAccount = profile ? primaryTeaMasterAccount(profile.associations) : null;
  const canManagePrimaryStock = canManageHostedMasterSelection(primaryAccount, activeAccountId, canManageStock);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-nav-gap-lg md:px-6 md:pt-10">
      <button type="button" onClick={() => navigate(-1)} className="tap-target inline-flex items-center gap-2 text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text">
        <ArrowLeft size={16} aria-hidden="true" /> Back
      </button>
      <header className="mt-8 max-w-3xl">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold`}>Tea Master identity</p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-3 text-tea-text`}>Your public profile</h1>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-4 max-w-[62ch] text-tea-text-sec`}>One identity for your tea selections, writing, favorites, and payment destinations across every associated store.</p>
        <a href="/account/settings" className="tap-target mt-4 inline-flex text-ui-13 text-tea-gold transition-colors hover:text-tea-gold-lt">Account settings</a>
      </header>

      {!profile ? (
        canStartProfileDraft(Boolean(profileQuery.data?.can_create), activeAccountId)
          ? <NewProfileForm name={auth.user?.name ?? ''} onCreate={value => updateProfile.mutateAsync(value)} />
          : <section className="mt-14 max-w-2xl rounded-md border border-tea-border bg-tea-surface px-5 py-6"><h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Profile setup unavailable</h2><p className="mt-2 text-ui-13 text-tea-text-sec">Your account cannot create a Tea Master profile yet. Nothing has been published.</p></section>
      ) : (
        <div className="mt-14 space-y-20">
          <section aria-labelledby="profile-readiness-heading" className="space-y-5">
            <div>
              <h2 id="profile-readiness-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Tea Master home</h2>
              {/* A tea master does not need a store, so the store sentence only
                  appears to someone who has one. */}
              <p className="mt-2 max-w-[64ch] text-ui-13 text-tea-text-sec">{profile.associations.length > 0
                ? 'Your profile is the global identity. Your primary Tea Master account is the operational home for its own stock and public tea selection; guest associations remain collaborations.'
                : 'Your profile is the global identity. It stands on its own: you can be found and paid here without selling anything. A store can be attached later.'}</p>
            </div>
            {/* A tea master with no store sees three items, not five, so the
                wide layout follows the list rather than leaving two gaps. */}
            <ul className={`grid gap-px overflow-hidden rounded-md border border-tea-border bg-tea-border sm:grid-cols-2 ${readiness.length > 3 ? 'lg:grid-cols-5' : 'lg:grid-cols-3'}`}>
              {readiness.map(item => (
                <li key={item.id} className="min-w-0 bg-tea-surface px-4 py-4">
                  <span className="flex items-center gap-2 text-ui-12 font-medium text-tea-text">{item.ready ? <CheckCircle size={16} className="shrink-0 text-tea-gold" aria-hidden="true" /> : <Circle size={16} className="shrink-0 text-tea-text-dim" aria-hidden="true" />}{item.label}</span>
                  <span className="mt-2 block text-ui-11 text-tea-text-sec">{item.detail}</span>
                </li>
              ))}
            </ul>
            {profile.is_published ? (
              <ProfileShareLinks slug={profile.slug} accountSlug={primaryAccount?.account_slug} showPayment={publicPaymentCount > 0} />
            ) : (
              <p className="rounded-md border border-tea-border bg-tea-surface px-4 py-3 text-ui-12 text-tea-text-sec">Public links appear here after the profile is approved and published.</p>
            )}
          </section>

          <ProfileEditor
            profile={profile}
            onSave={value => updateProfile.mutateAsync(value).then(() => undefined)}
            onSaveGallery={images => api.profile.updateGalleryImages(images).then(() => refreshProfile()).then(() => undefined)}
            onUnpublish={() => api.profile.unpublishSelf().then(() => refreshProfile()).then(() => undefined)}
            onUploadPortrait={image => api.profile.uploadImage(image, 'portrait')}
          />

          {favoritesQuery.isLoading ? (
            <ProfileSectionState title="Public favorites" loading />
          ) : favoritesQuery.isError ? (
            <ProfileSectionState title="Public favorites" message={favoritesQuery.error instanceof Error ? favoritesQuery.error.message : 'Favorites could not be loaded.'} onRetry={() => favoritesQuery.refetch()} />
          ) : (
            <ProfileFavoritesEditor
              favorites={favoritesQuery.data?.favorites ?? []}
              availableTeas={favoritesQuery.data?.available_teas ?? []}
              onCreate={async (favorite: FavoriteWrite) => { await api.profile.createFavorite(favorite); await refreshProfile(); }}
              onUpdate={async (teaId, favorite) => { await api.profile.updateFavorite(teaId, favorite); await refreshProfile(); }}
              onDelete={async teaId => { await api.profile.deleteFavorite(teaId); await refreshProfile(); }}
              onReorder={async ids => { await api.profile.reorderFavorites(ids); await refreshProfile(); }}
              collection={profile.collection ?? null}
              onSaveCollection={async title => { await api.profile.updateCollection(title); await refreshProfile(); }}
            />
          )}

          {paymentsQuery.isLoading ? (
            <ProfileSectionState title="Payment methods" loading />
          ) : paymentsQuery.isError ? (
            <ProfileSectionState title="Payment methods" message={paymentsQuery.error instanceof Error ? paymentsQuery.error.message : 'Payment methods could not be loaded.'} onRetry={() => paymentsQuery.refetch()} />
          ) : (
            <PaymentMethodsEditor
              contributorName={profile.display_name}
              associations={profile.associations}
              methods={paymentsQuery.data?.methods ?? []}
              onCreate={async (method: PaymentMethodWrite) => { await api.profile.createPaymentMethod(method); await refreshProfile(); }}
              onUpdate={async (id, method) => { await api.profile.updatePaymentMethod(id, method); await refreshProfile(); }}
              onDelete={async id => { await api.profile.deletePaymentMethod(id); await refreshProfile(); }}
            />
          )}

          <PayAccessPanel contributorName={profile.display_name} canShare={publicPaymentCount > 0} />

          <section className="grid gap-5 border-t border-tea-border pt-8 md:grid-cols-2">
            <div>
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Tea selection</h2>
              <p className="mt-2 text-ui-13 text-tea-text-sec">This is the visible selection from your hosted, public Tea Master home, not teas from stores where you are only a guest or collaborator.</p>
              {canManagePrimaryStock ? <a href="/admin/stock" className="tap-target mt-3 inline-flex text-ui-13 text-tea-gold hover:text-tea-gold-lt">Manage Tea Master stock →</a> : <p className="mt-3 text-ui-12 text-tea-text-dim">{primaryAccount ? `Switch to ${primaryAccount.account_name} in the account menu to manage this selection.` : 'Connect a hosted Tea Master account before managing a public selection.'}</p>}
            </div>
            <div>
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Writing</h2>
              <p className="mt-2 text-ui-13 text-tea-text-sec">Published articles attributed to this global profile appear automatically.</p>
              {canManageWriting ? <a href="/admin/magazine" className="tap-target mt-3 inline-flex text-ui-13 text-tea-gold hover:text-tea-gold-lt">Manage writing →</a> : <p className="mt-3 text-ui-12 text-tea-text-dim">Writing controls appear when your account has publishing access.</p>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function NewProfileForm({ name, onCreate }: { name: string; onCreate: (value: SelfProfileUpdate & { id: string }) => Promise<unknown> }) {
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState(name);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = 'w-full rounded-md border border-tea-border bg-tea-surface px-3 py-2.5 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none focus:ring-2 focus:ring-tea-gold/30';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      await onCreate({ id: slug, display_name: displayName, business_name: null, beginnings: bio, chinese_name: null, now_text: null, inspirations: null, closing: null, location_line: null, languages: [], avatar_url: null, portrait_url: null, links: [] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The profile draft could not be created.'); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="mt-14 max-w-2xl space-y-5 border-y border-tea-border py-8">
      <div><h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Begin a private draft</h2><p className="mt-2 text-ui-12 text-tea-text-dim">Creating the draft does not publish it or grant Tea Master status.</p></div>
      <label className="block"><span className={`${TYPOGRAPHY_CLASSES.label} mb-2 block text-tea-text-sec`}>Public name</span><input required value={displayName} onChange={event => setDisplayName(event.target.value)} className={field} /></label>
      <label className="block"><span className={`${TYPOGRAPHY_CLASSES.label} mb-2 block text-tea-text-sec`}>Profile address</span><div className="flex min-w-0 items-center"><span className="rounded-l-md border border-r-0 border-tea-border bg-tea-surface px-3 py-2.5 text-ui-13 text-tea-text-dim">teajia.com/people/</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={event => setSlug(event.target.value.toLowerCase())} className={`${field} rounded-l-none`} /></div></label>
      <label className="block"><span className={`${TYPOGRAPHY_CLASSES.label} mb-2 block text-tea-text-sec`}>Short biography</span><textarea required rows={5} value={bio} onChange={event => setBio(event.target.value)} className={field} /></label>
      {error && <p role="alert" className="text-ui-13 text-tea-text">{error}</p>}
      <div className="flex justify-end"><button type="submit" disabled={saving} className="cta-solid tap-target rounded-md px-5 py-2.5 text-ui-13 disabled:opacity-50">{saving ? 'Creating…' : 'Create draft'}</button></div>
    </form>
  );
}

function ProfileLoading() {
  return <main aria-label="Loading profile" className="mx-auto w-full max-w-5xl animate-pulse px-4 pt-12 pb-nav-gap-lg md:px-6"><div className="h-4 w-28 rounded-md bg-tea-surface" /><div className="mt-6 h-12 w-72 max-w-full rounded-md bg-tea-surface" /><div className="mt-14 h-64 rounded-md border border-tea-border bg-tea-surface" /></main>;
}

function ProfileError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <main className="mx-auto w-full max-w-3xl px-4 py-20 pb-nav-gap-lg md:px-6"><h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Profile unavailable</h1><p role="alert" className="mt-4 text-ui-13 text-tea-text-sec">{message}</p><button type="button" onClick={onRetry} className="tap-target mt-5 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button></main>;
}

function ProfileSectionState({ title, loading = false, message, onRetry }: { title: string; loading?: boolean; message?: string; onRetry?: () => void }) {
  return (
    <section aria-busy={loading || undefined} className="border-y border-tea-border py-8">
      <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{title}</h2>
      {loading ? (
        <div aria-label={`Loading ${title.toLowerCase()}`} className="mt-5 animate-pulse space-y-3">
          <div className="h-4 w-48 max-w-full rounded-md bg-tea-surface" />
          <div className="h-12 rounded-md bg-tea-surface" />
        </div>
      ) : (
        <div><p role="alert" className="mt-3 text-ui-13 text-tea-text-sec">{title}: {message}</p>{onRetry && <button type="button" onClick={onRetry} className="tap-target mt-3 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button>}</div>
      )}
    </section>
  );
}
