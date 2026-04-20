import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../context/AuthContext';

type ProfileStatus = 'idle' | 'loading' | 'ready' | 'missing';

const PROFILE_CACHE_KEY = 'detroit-axle-profile-cache-v2';

type ProfileCachePayload = {
  userId: string;
  profile: UserProfile;
  cachedAt: number;
};

function readProfileCache(): ProfileCachePayload | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ProfileCachePayload;
    if (!parsed?.userId || !parsed?.profile) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeProfileCache(userId: string, profile: UserProfile) {
  if (typeof window === 'undefined') return;

  const payload: ProfileCachePayload = {
    userId,
    profile,
    cachedAt: Date.now(),
  };

  window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
}

function clearProfileCache() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
}

export function isRecoveryLinkActive() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return hash.includes('type=recovery') || search.includes('type=recovery');
}

export function clearRecoveryUrlState() {
  if (typeof window === 'undefined') return;
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

export function useAuthState() {
  const cachedProfile = readProfileCache();

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(
    cachedProfile?.profile ?? null
  );
  const [loading, setLoading] = useState(cachedProfile ? false : true);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>(
    cachedProfile ? 'ready' : 'idle'
  );
  const [profileError, setProfileError] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);

  const recoveryModeRef = useRef(false);
  const profileRef = useRef<UserProfile | null>(cachedProfile?.profile ?? null);
  const activeUserIdRef = useRef<string | null>(cachedProfile?.userId ?? null);
  const profileRequestIdRef = useRef(0);

  useEffect(() => {
    recoveryModeRef.current = recoveryMode;
  }, [recoveryMode]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    void loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
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

        const hydratedFromCache = hydrateProfileFromCache(newSession.user.id);
        void loadProfile(newSession.user.id, {
          background: hydratedFromCache,
        });
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
  }, []);

  function hydrateProfileFromCache(userId: string) {
    const cached = readProfileCache();

    if (cached?.userId === userId && cached.profile) {
      setProfile(cached.profile);
      setProfileStatus('ready');
      setProfileError('');
      setLoading(false);
      return true;
    }

    return false;
  }

  async function loadInitialSession() {
    const recoveryActive = isRecoveryLinkActive();
    if (recoveryActive) setRecoveryMode(true);

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      setLoading(false);
      return;
    }

    setSession(data.session);

    if (recoveryActive && data.session?.user) {
      activeUserIdRef.current = data.session.user.id;
      setLoading(false);
      return;
    }

    if (data.session?.user) {
      activeUserIdRef.current = data.session.user.id;
      const hydratedFromCache = hydrateProfileFromCache(data.session.user.id);

      await loadProfile(data.session.user.id, {
        background: hydratedFromCache,
      });
      return;
    }

    activeUserIdRef.current = null;
    clearProfileCache();
    setProfile(null);
    setProfileStatus('idle');
    setProfileError('');
    setLoading(false);
  }

  async function loadProfile(
    userId: string,
    options?: { background?: boolean }
  ) {
    const requestId = ++profileRequestIdRef.current;
    const isBackground = options?.background === true;

    if (!isBackground || !profileRef.current) {
      setLoading(true);
    }

    if (!isBackground) {
      setProfileStatus('loading');
    }

    setProfileError('');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (requestId !== profileRequestIdRef.current) {
      return;
    }

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

    const nextProfile = data as UserProfile;
    writeProfileCache(userId, nextProfile);
    setProfile(nextProfile);
    setProfileStatus('ready');
    setLoading(false);
  }

  async function logout() {
    profileRequestIdRef.current += 1;
    await supabase.auth.signOut();
    clearRecoveryUrlState();
    clearProfileCache();
    activeUserIdRef.current = null;
    setSession(null);
    setProfile(null);
    setProfileStatus('idle');
    setProfileError('');
    setRecoveryMode(false);
    setLoading(false);
  }

  function handleRecoveryComplete() {
    clearRecoveryUrlState();
    setRecoveryMode(false);
    setProfileStatus('idle');
    setProfileError('');

    if (session?.user?.id) {
      void loadProfile(session.user.id);
    }
  }

  return {
    session,
    profile,
    loading,
    profileStatus,
    profileError,
    recoveryMode,
    logout,
    handleRecoveryComplete,
    reloadProfile: (id: string) => loadProfile(id),
  };
}