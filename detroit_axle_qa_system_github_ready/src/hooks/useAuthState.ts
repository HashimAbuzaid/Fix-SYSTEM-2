/**
 * useAuthState.ts
 * Manages Supabase auth session, user profile fetching, and password recovery mode.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../context/AuthContext';

type ProfileStatus = 'idle' | 'loading' | 'ready' | 'missing';

interface ProfileCachePayload {
  userId: string;
  profile: UserProfile;
  cachedAt: number;
}

const PROFILE_CACHE_KEY = 'detroit-axle-profile-cache-v2';
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

/* ── Cache helpers ── */

function readProfileCache(): ProfileCachePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileCachePayload;
    if (!parsed?.userId || !parsed?.profile) return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeProfileCache(userId: string, profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ProfileCachePayload = { userId, profile, cachedAt: Date.now() };
    window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

function clearProfileCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/* ── URL helpers ── */

export function isRecoveryLinkActive(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return hash.includes('type=recovery') || search.includes('type=recovery');
}

export function clearRecoveryUrlState(): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

/* ── Hook ── */

export interface UseAuthStateReturn {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileStatus: ProfileStatus;
  profileError: string;
  recoveryMode: boolean;
  logout: () => Promise<void>;
  handleRecoveryComplete: () => void;
  reloadProfile: (userId: string) => Promise<void>;
}

export function useAuthState(): UseAuthStateReturn {
  const cached = useMemo(() => readProfileCache(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(cached?.profile ?? null);
  const [loading, setLoading] = useState(!cached);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>(cached ? 'ready' : 'idle');
  const [profileError, setProfileError] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);

  // Refs to avoid stale closures in Supabase callbacks
  const recoveryModeRef = useRef(recoveryMode);
  const profileRef = useRef(profile);
  const activeUserIdRef = useRef<string | null>(cached?.userId ?? null);
  const profileRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    recoveryModeRef.current = recoveryMode;
  }, [recoveryMode]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* ── Profile loader ── */

  const hydrateProfileFromCache = useCallback((userId: string): boolean => {
    const cached = readProfileCache();
    if (cached?.userId === userId && cached.profile) {
      if (isMountedRef.current) {
        setProfile(cached.profile);
        setProfileStatus('ready');
        setProfileError('');
        setLoading(false);
      }
      return true;
    }
    return false;
  }, []);

  const loadProfile = useCallback(
    async (userId: string, options?: { background?: boolean }) => {
      const requestId = ++profileRequestIdRef.current;
      const isBackground = options?.background === true;

      if (!isBackground || !profileRef.current) {
        if (isMountedRef.current) setLoading(true);
      }
      if (!isBackground && isMountedRef.current) {
        setProfileStatus('loading');
      }
      if (isMountedRef.current) setProfileError('');

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, is_active')
          .eq('id', userId)
          .maybeSingle();

        // Deduplicate stale requests
        if (requestId !== profileRequestIdRef.current) return;
        if (!isMountedRef.current) return;

        if (error) {
          if (!isBackground) {
            setProfile(null);
            setProfileStatus('missing');
          }
          setProfileError('Could not load profile.');
          setLoading(false);
          return;
        }

        if (!data) {
          clearProfileCache();
          setProfile(null);
          setProfileStatus('missing');
          setLoading(false);
          return;
        }

        const nextProfile = data as unknown as UserProfile;
        writeProfileCache(userId, nextProfile);
        setProfile(nextProfile);
        setProfileStatus('ready');
        setLoading(false);
      } catch (err) {
        if (requestId !== profileRequestIdRef.current) return;
        if (!isMountedRef.current) return;

        if (!isBackground) {
          setProfile(null);
          setProfileStatus('missing');
        }
        setProfileError(err instanceof Error ? err.message : 'Unknown error loading profile.');
        setLoading(false);
      }
    },
    []
  );

  /* ── Session bootstrap ── */

  const loadInitialSession = useCallback(async () => {
    const recoveryActive = isRecoveryLinkActive();
    if (recoveryActive && isMountedRef.current) setRecoveryMode(true);

    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      if (isMountedRef.current) setLoading(false);
      if (!data.session) {
        activeUserIdRef.current = null;
        clearProfileCache();
        if (isMountedRef.current) {
          setProfile(null);
          setProfileStatus('idle');
        }
      }
      return;
    }

    if (isMountedRef.current) setSession(data.session);

    if (recoveryActive && data.session.user) {
      activeUserIdRef.current = data.session.user.id;
      if (isMountedRef.current) setLoading(false);
      return;
    }

    if (data.session.user) {
      activeUserIdRef.current = data.session.user.id;
      const hydrated = hydrateProfileFromCache(data.session.user.id);
      await loadProfile(data.session.user.id, { background: hydrated });
    }
  }, [hydrateProfileFromCache, loadProfile]);

  /* ── Auth listener ── */

  useEffect(() => {
    void loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMountedRef.current) return;

      setSession(newSession);

      const shouldStayInRecovery =
        event === 'PASSWORD_RECOVERY' ||
        isRecoveryLinkActive() ||
        recoveryModeRef.current;

      if (shouldStayInRecovery && newSession?.user) {
        activeUserIdRef.current = newSession.user.id;
        setRecoveryMode(true);
        setProfile(null);
        setProfileStatus('idle');
        setProfileError('');
        setLoading(false);
        return;
      }

      if (newSession?.user) {
        setRecoveryMode(false);
        activeUserIdRef.current = newSession.user.id;

        const hydrated = hydrateProfileFromCache(newSession.user.id);
        void loadProfile(newSession.user.id, { background: hydrated });
      } else {
        profileRequestIdRef.current += 1;
        activeUserIdRef.current = null;
        clearProfileCache();
        setProfile(null);
        setProfileStatus('idle');
        setProfileError('');
        setRecoveryMode(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadInitialSession, hydrateProfileFromCache, loadProfile]);

  /* ── Public actions ── */

  const logout = useCallback(async () => {
    profileRequestIdRef.current += 1;
    await supabase.auth.signOut();
    clearRecoveryUrlState();
    clearProfileCache();
    activeUserIdRef.current = null;

    if (isMountedRef.current) {
      setSession(null);
      setProfile(null);
      setProfileStatus('idle');
      setProfileError('');
      setRecoveryMode(false);
      setLoading(false);
    }
  }, []);

  const handleRecoveryComplete = useCallback(() => {
    clearRecoveryUrlState();
    setRecoveryMode(false);
    setProfileStatus('idle');
    setProfileError('');

    if (session?.user?.id) {
      void loadProfile(session.user.id);
    }
  }, [session?.user?.id, loadProfile]);

  const reloadProfile = useCallback(
    (userId: string) => loadProfile(userId),
    [loadProfile]
  );

  return {
    session,
    profile,
    loading,
    profileStatus,
    profileError,
    recoveryMode,
    logout,
    handleRecoveryComplete,
    reloadProfile,
  };
}