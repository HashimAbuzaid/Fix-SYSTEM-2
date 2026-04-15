import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../context/AuthContext';

type ProfileStatus = 'idle' | 'loading' | 'ready' | 'missing';

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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle');
  const [profileError, setProfileError] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const recoveryModeRef = useRef(false);

  useEffect(() => {
    recoveryModeRef.current = recoveryMode;
  }, [recoveryMode]);

  useEffect(() => {
    void loadInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      const shouldStayInRecovery =
        event === 'PASSWORD_RECOVERY' ||
        isRecoveryLinkActive() ||
        recoveryModeRef.current;

      if (shouldStayInRecovery && newSession?.user) {
        setRecoveryMode(true);
        setProfileStatus('idle');
        setLoading(false);
        return;
      }

      if (newSession?.user) {
        setRecoveryMode(false);
        void loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setProfileStatus('idle');
        setProfileError('');
        setRecoveryMode(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      setLoading(false);
      return;
    }

    if (data.session?.user) {
      await loadProfile(data.session.user.id);
    } else {
      setLoading(false);
    }
  }

  async function loadProfile(userId: string) {
    setProfileStatus('loading');
    setProfileError('');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      setProfile(null);
      setProfileStatus('missing');
      setProfileError('Could not load profile.');
      setLoading(false);
      return;
    }

    if (!data) {
      setProfile(null);
      setProfileStatus('missing');
      setLoading(false);
      return;
    }

    setProfile(data as UserProfile);
    setProfileStatus('ready');
    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    clearRecoveryUrlState();
    setSession(null);
    setProfile(null);
    setProfileStatus('idle');
    setProfileError('');
    setRecoveryMode(false);
  }

  function handleRecoveryComplete() {
    clearRecoveryUrlState();
    setRecoveryMode(false);
    setProfileStatus('idle');
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
