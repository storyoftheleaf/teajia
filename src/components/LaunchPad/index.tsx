import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Heart, BookOpen, Bookmark, Clock, Package, Calendar,
  Users, Shield, LogOut, LogIn, ChevronRight, Eye, EyeOff,
  SlidersHorizontal,
} from 'lucide-react';
import { LogoText } from '../Logos/LogoText';
import { useAuth } from '../../hooks/useAuth';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { PanelView } from '../AccountPanel/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LaunchPadProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateHome: () => void;
  onOpenAccount: (view?: PanelView) => void;
}

interface TileConfig {
  key: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  action: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const LaunchPad: React.FC<LaunchPadProps> = ({
  isOpen,
  onClose,
  onNavigateHome,
  onOpenAccount,
}) => {
  const { user, isAuthenticated, isAdmin, login, logout } = useAuth();
  const navigate = useNavigate();
  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Sign-in form
  const [showSignIn, setShowSignIn] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const isStaff = user?.role === 'staff' || isAdmin;

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setShowSignIn(false);
        setFormError('');
        setIdentifier('');
        setPassword('');
      }, 400);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleNavigate = useCallback((path: string) => {
    onClose();
    setTimeout(() => navigate(path), 200);
  }, [onClose, navigate]);

  const handleOpenAccount = useCallback((view?: PanelView) => {
    onClose();
    setTimeout(() => onOpenAccount(view), 200);
  }, [onClose, onOpenAccount]);

  const handleHome = useCallback(() => {
    onNavigateHome();
    onClose();
  }, [onNavigateHome, onClose]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      await login(identifier, password);
      setShowSignIn(false);
    } catch (err: any) {
      setFormError(err?.message || 'Sign in failed. Check your details.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  // ── Tile definitions ──────────────────────────────────────────────────────

  const memberTiles: TileConfig[] = [
    {
      key: 'collection',
      icon: <Heart className="w-4 h-4" />,
      label: 'My Collection',
      sublabel: 'Saved teas',
      action: () => handleOpenAccount('collection'),
    },
    {
      key: 'journal',
      icon: <BookOpen className="w-4 h-4" />,
      label: 'Tasting Journal',
      sublabel: 'Your sessions',
      action: () => handleOpenAccount('tasting-journal'),
    },
    {
      key: 'saved',
      icon: <Bookmark className="w-4 h-4" />,
      label: 'Saved Stories',
      sublabel: 'Reading list',
      action: () => handleOpenAccount('saved-stories'),
    },
    {
      key: 'history',
      icon: <Clock className="w-4 h-4" />,
      label: 'Reading History',
      sublabel: 'Recently read',
      action: () => handleOpenAccount('reading-history'),
    },
    {
      key: 'compass',
      icon: <SlidersHorizontal className="w-4 h-4" />,
      label: 'Tea Compass',
      sublabel: 'Navigate flavour',
      action: () => handleOpenAccount('tea-compass'),
    },
  ];

  const staffTiles: TileConfig[] = [
    {
      key: 'inventory',
      icon: <Package className="w-4 h-4" />,
      label: 'Inventory',
      sublabel: 'Stock & products',
      action: () => handleNavigate('/admin/inventory'),
    },
    {
      key: 'activity',
      icon: <SlidersHorizontal className="w-4 h-4" />,
      label: 'Activity',
      sublabel: 'Orders & inquiries',
      action: () => handleNavigate('/admin/activity'),
    },
  ];

  const adminTiles: TileConfig[] = [
    {
      key: 'events',
      icon: <Calendar className="w-4 h-4" />,
      label: 'Events',
      sublabel: 'Manage events',
      action: () => handleNavigate('/admin/events'),
    },
    {
      key: 'people',
      icon: <Users className="w-4 h-4" />,
      label: 'People',
      sublabel: 'Team & guests',
      action: () => handleNavigate('/admin/people'),
    },
    {
      key: 'admin',
      icon: <Shield className="w-4 h-4" />,
      label: 'Admin',
      sublabel: 'Full dashboard',
      action: () => handleNavigate('/admin'),
    },
  ];

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderTile = (tile: TileConfig, index: number) => (
    <motion.button
      key={tile.key}
      onClick={tile.action}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.25 }}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-sm border border-tea-border bg-tea-surface/60 hover:bg-tea-surface hover:border-tea-gold/20 transition-all duration-200 group text-left"
    >
      <span className="text-tea-text-sec group-hover:text-tea-gold transition-colors flex-shrink-0">
        {tile.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs uppercase tracking-[0.12em] text-tea-text group-hover:text-tea-gold transition-colors">{tile.label}</span>
        <span className="block text-[11px] text-tea-text-dim mt-0.5">{tile.sublabel}</span>
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-tea-text/20 group-hover:text-tea-gold/40 transition-colors flex-shrink-0" />
    </motion.button>
  );

  const renderSection = (label: string, tiles: TileConfig[], startIndex: number) => (
    <div className="space-y-1.5">
      <p className="text-[9px] uppercase tracking-[0.2em] text-tea-text-dim px-1 mb-2">{label}</p>
      {tiles.map((tile, i) => renderTile(tile, startIndex + i))}
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-toast bg-tea-text/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />

          {/* Panel — slides up from bottom on mobile, centered modal on desktop */}
          <motion.div
            ref={focusTrapRef}
            role="dialog"
            aria-modal="true"
            aria-label="Teajia launchpad"
            className="fixed z-toast w-full md:w-[420px] flex flex-col outline-none glass-grain"
            style={{
              bottom: 0,
              left: '50%',
              x: '-50%',
              maxHeight: '92vh',
              background: 'var(--tea-bg)',
              borderTop: '1px solid var(--tea-border)',
              borderLeft: '1px solid var(--tea-border)',
              borderRight: '1px solid var(--tea-border)',
              borderRadius: '12px 12px 0 0',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            tabIndex={-1}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-tea-text/15" />
            </div>

            {/* Header — wordmark links home */}
            <div className="flex items-center justify-center pt-4 pb-5 flex-shrink-0 relative">
              <button
                onClick={handleHome}
                className="flex flex-col items-center gap-1 group"
                aria-label="Return to home"
              >
                <LogoText
                  size="panel"
                  color="var(--tea-gold)"
                  className="opacity-90 group-hover:opacity-100 transition-opacity"
                />
                <span className="text-[9px] uppercase tracking-[0.2em] text-tea-text-dim group-hover:text-tea-text-sec transition-colors">
                  return home
                </span>
              </button>

              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors rounded-full"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="h-px bg-tea-border mx-4 flex-shrink-0" />

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto tea-card-scroll px-4 py-5 space-y-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>

              {/* ── Not authenticated ─────────────────────────────────── */}
              {!isAuthenticated && (
                <AnimatePresence mode="wait">
                  {!showSignIn ? (
                    <motion.div
                      key="guest"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-5"
                    >
                      <div className="text-center space-y-2 pt-2">
                        <p className="font-serif text-base text-tea-text">Welcome to 茶家</p>
                        <p className="text-xs text-tea-text-sec leading-relaxed max-w-[280px] mx-auto">
                          Sign in to access your collection, tasting journal, and personal tea compass.
                        </p>
                      </div>
                      <div className="space-y-2 pt-1">
                        <button
                          onClick={() => setShowSignIn(true)}
                          className="flex items-center justify-center gap-2 w-full py-3 bg-tea-gold text-white text-[11px] uppercase tracking-[0.2em] hover:bg-tea-gold-lt transition-colors"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          Sign In
                        </button>
                        <button
                          onClick={() => handleOpenAccount('signup' as PanelView)}
                          className="flex items-center justify-center w-full py-3 border border-tea-border text-tea-text-sec text-[11px] uppercase tracking-[0.2em] hover:border-tea-gold/30 hover:text-tea-text transition-all"
                        >
                          Join Teajia
                        </button>
                      </div>
                      <div className="pt-2">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-tea-text-dim text-center mb-3">Members get access to</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { icon: <Heart className="w-3.5 h-3.5" />, label: 'Tea Collection' },
                            { icon: <BookOpen className="w-3.5 h-3.5" />, label: 'Tasting Journal' },
                            { icon: <Bookmark className="w-3.5 h-3.5" />, label: 'Saved Stories' },
                            { icon: <SlidersHorizontal className="w-3.5 h-3.5" />, label: 'Tea Compass' },
                          ].map(({ icon, label }) => (
                            <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-sm bg-tea-surface border border-tea-border">
                              <span className="text-tea-text-sec">{icon}</span>
                              <span className="text-[11px] text-tea-text-sec">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="signin"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setShowSignIn(false); setFormError(''); }}
                          className="text-tea-text-sec hover:text-tea-text transition-colors"
                          aria-label="Back"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <p className="font-serif text-sm text-tea-text">Sign in</p>
                      </div>

                      <form onSubmit={handleSignIn} className="space-y-3">
                        <div>
                          <label htmlFor="lp-identifier" className="block text-[11px] uppercase tracking-[0.15em] text-tea-text-sec mb-1">Email or Username</label>
                          <input
                            id="lp-identifier"
                            type="text"
                            autoComplete="email"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="w-full bg-tea-surface border-b border-tea-border p-2 font-serif text-base placeholder:text-tea-text/20 focus:outline-none focus:border-tea-gold transition-colors min-h-[44px]"
                            placeholder="your@email.com"
                          />
                        </div>
                        <div>
                          <label htmlFor="lp-password" className="block text-[11px] uppercase tracking-[0.15em] text-tea-text-sec mb-1">Password</label>
                          <div className="relative">
                            <input
                              id="lp-password"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="current-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-tea-surface border-b border-tea-border p-2 pr-10 font-serif text-base placeholder:text-tea-text/20 focus:outline-none focus:border-tea-gold transition-colors min-h-[44px]"
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(p => !p)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-tea-text-sec hover:text-tea-text transition-colors"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        {formError && (
                          <p className="text-xs text-red-500">{formError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={formLoading || !identifier || !password}
                          className="w-full py-3 bg-tea-gold text-white text-[11px] uppercase tracking-[0.2em] hover:bg-tea-gold-lt disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                        >
                          {formLoading ? 'Signing in…' : 'Sign In'}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* ── Authenticated ─────────────────────────────────────── */}
              {isAuthenticated && (
                <div className="space-y-5">
                  {/* Greeting */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-serif text-base text-tea-text">{user?.name || 'Welcome back'}</p>
                      <p className="text-[11px] text-tea-text-dim mt-0.5 capitalize">{user?.role || 'member'}</p>
                    </div>
                    <button
                      onClick={() => handleOpenAccount()}
                      className="text-[11px] uppercase tracking-[0.12em] text-tea-text-sec hover:text-tea-gold transition-colors border border-tea-border px-3 py-1.5 hover:border-tea-gold/30"
                    >
                      Settings
                    </button>
                  </div>

                  {/* Member tiles */}
                  {renderSection('Your space', memberTiles, 0)}

                  {/* Staff tiles */}
                  {isStaff && renderSection('Operations', staffTiles, memberTiles.length)}

                  {/* Admin tiles */}
                  {isAdmin && renderSection('Administration', adminTiles, memberTiles.length + staffTiles.length)}

                  {/* Sign out */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full py-2 text-tea-text-dim hover:text-tea-text-sec transition-colors text-[11px] uppercase tracking-[0.15em]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
