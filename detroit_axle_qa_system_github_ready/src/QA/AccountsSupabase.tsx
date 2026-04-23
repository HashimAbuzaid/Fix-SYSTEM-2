import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

type ProfileRole = 'admin' | 'qa' | 'agent' | 'supervisor';

type ProfileRow = {
  id: string;
  role: ProfileRole;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: 'Calls' | 'Tickets' | 'Sales' | null;
  email: string;
  created_at?: string;
};

function roleNeedsTeam(role: ProfileRole) {
  return role === 'agent' || role === 'supervisor';
}

function roleNeedsAgentId(role: ProfileRole) {
  return role === 'agent';
}

function roleNeedsDisplayName(role: ProfileRole) {
  return role === 'agent';
}


function useThemeRefresh() {
  const [themeRefreshKey, setThemeRefreshKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const refreshTheme = () => setThemeRefreshKey((value) => value + 1);
    const observer = new MutationObserver(refreshTheme);
    const observerConfig = {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-mode'],
    };

    observer.observe(document.documentElement, observerConfig);

    if (document.body) {
      observer.observe(document.body, observerConfig);
    }

    window.addEventListener('storage', refreshTheme);
    window.addEventListener('detroit-axle-theme-change', refreshTheme as EventListener);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', refreshTheme);
      window.removeEventListener(
        'detroit-axle-theme-change',
        refreshTheme as EventListener
      );
    };
  }, []);

  return themeRefreshKey;
}

function getAccountsThemeVars(): Record<string, string> {
  const themeMode =
    typeof document !== 'undefined'
      ? (
          document.body.dataset.theme ||
          document.documentElement.dataset.theme ||
          document.documentElement.getAttribute('data-theme-mode') ||
          window.localStorage.getItem('detroit-axle-theme-mode') ||
          window.sessionStorage.getItem('detroit-axle-theme-mode') ||
          window.localStorage.getItem('detroit-axle-theme') ||
          window.sessionStorage.getItem('detroit-axle-theme') ||
          ''
        ).toLowerCase()
      : '';

  const isLight = themeMode === 'light' || themeMode === 'white';

  return {
    '--screen-text': isLight ? '#334155' : '#e5eefb',
    '--screen-heading': isLight ? '#0f172a' : '#f8fafc',
    '--screen-muted': isLight ? '#475569' : '#cbd5e1',
    '--screen-subtle': isLight ? '#64748b' : '#94a3b8',
    '--screen-accent': isLight ? '#2563eb' : '#60a5fa',
    '--screen-accent-soft': isLight ? '#1d4ed8' : '#93c5fd',
    '--screen-panel-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(243,247,255,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%)',
    '--screen-card-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,255,0.97) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.74) 0%, rgba(15,23,42,0.56) 100%)',
    '--screen-soft-fill': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.60)',
    '--screen-field-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%)'
      : 'rgba(15,23,42,0.70)',
    '--screen-field-text': isLight ? '#334155' : '#e5eefb',
    '--screen-border': isLight ? 'rgba(203,213,225,0.92)' : 'rgba(148,163,184,0.14)',
    '--screen-border-strong': isLight ? 'rgba(203,213,225,1)' : 'rgba(148,163,184,0.18)',
    '--screen-table-head-bg': isLight ? 'rgba(241,245,255,0.98)' : 'rgba(15,23,42,0.42)',
    '--screen-secondary-btn-bg': isLight ? 'rgba(255,255,255,0.99)' : 'rgba(15,23,42,0.74)',
    '--screen-secondary-btn-text': isLight ? '#475569' : '#e5eefb',
    '--screen-shadow': isLight ? '0 18px 40px rgba(15,23,42,0.08)' : '0 18px 40px rgba(2,6,23,0.35)',
    '--screen-error-bg': isLight ? 'rgba(254,242,242,0.98)' : 'rgba(127,29,29,0.24)',
    '--screen-error-border': isLight ? 'rgba(248,113,113,0.28)' : 'rgba(248,113,113,0.22)',
    '--screen-error-text': isLight ? '#b91c1c' : '#fecaca',
    '--screen-success-bg': isLight ? 'rgba(240,253,244,0.98)' : 'rgba(22,101,52,0.16)',
    '--screen-success-border': isLight ? 'rgba(74,222,128,0.28)' : 'rgba(74,222,128,0.20)',
    '--screen-success-text': isLight ? '#166534' : '#bbf7d0',
    '--screen-warning-bg': isLight ? 'rgba(255,251,235,0.98)' : 'rgba(146,64,14,0.16)',
    '--screen-warning-border': isLight ? 'rgba(251,191,36,0.30)' : 'rgba(251,191,36,0.20)',
    '--screen-warning-text': isLight ? '#92400e' : '#fde68a',
  };
}

function AccountsSupabase() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [id, setId] = useState('');
  const [role, setRole] = useState<ProfileRole>('agent');
  const [agentId, setAgentId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [team, setTeam] = useState<'Calls' | 'Tickets' | 'Sales' | ''>('');
  const [email, setEmail] = useState('');

  const themeRefreshKey = useThemeRefresh();
  const themeVars = useMemo(() => getAccountsThemeVars(), [themeRefreshKey]);

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setProfiles((data as ProfileRow[]) || []);
  }

  function resetForm() {
    setErrorMessage('');
    setSuccessMessage('');
    setId('');
    setRole('agent');
    setAgentId('');
    setAgentName('');
    setDisplayName('');
    setTeam('');
    setEmail('');
    setEditingProfileId(null);
  }

  function startEditProfile(profile: ProfileRow) {
    setErrorMessage('');
    setSuccessMessage('');
    setPendingDeleteId(null);
    setEditingProfileId(profile.id);
    setId(profile.id);
    setRole(profile.role);
    setAgentId(roleNeedsAgentId(profile.role) ? profile.agent_id || '' : '');
    setAgentName(profile.agent_name);
    setDisplayName(
      roleNeedsDisplayName(profile.role) ? profile.display_name || '' : ''
    );
    setTeam(roleNeedsTeam(profile.role) ? profile.team || '' : '');
    setEmail(profile.email);
  }

  async function validateAgentUniqueness(profileIdToIgnore?: string) {
    if (role !== 'agent') return true;

    setErrorMessage('');

    const cleanAgentId = agentId.trim();

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'agent')
      .eq('agent_id', cleanAgentId)
      .eq('team', team);

    if (error) {
      setErrorMessage(error.message);
      return false;
    }

    const duplicate = (data || []).find(
      (item) => item.id !== profileIdToIgnore
    );

    if (duplicate) {
      setErrorMessage(
        `Agent ID ${cleanAgentId} already exists in ${team}. Please use a different Agent ID or edit the existing row.`
      );
      return false;
    }

    return true;
  }

  async function handleCreateProfile() {
    setErrorMessage('');
    setSuccessMessage('');
    const cleanId = id.trim();
    const cleanAgentId = agentId.trim();
    const cleanAgentName = agentName.trim();
    const cleanDisplayName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanId || !cleanAgentName || !cleanEmail || !role) {
      setErrorMessage('Please fill UUID, Name, Email, and Role.');
      return;
    }

    if (role === 'agent' && (!cleanAgentId || !team)) {
      setErrorMessage('Please fill Agent ID and Team for an agent.');
      return;
    }

    if (role === 'supervisor' && !team) {
      setErrorMessage('Please select a Team for a supervisor.');
      return;
    }

    setSaving(true);

    const { data: existingProfile, error: existingProfileError } =
      await supabase
        .from('profiles')
        .select('id')
        .eq('id', cleanId)
        .maybeSingle();

    if (existingProfileError) {
      setSaving(false);
      setErrorMessage(existingProfileError.message);
      return;
    }

    if (existingProfile) {
      setSaving(false);
      setErrorMessage(
        'This Auth User UUID already has a profile. Use a different UUID or edit the existing profile.'
      );
      return;
    }

    const isUnique = await validateAgentUniqueness();
    if (!isUnique) {
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('profiles').insert({
      id: cleanId,
      role,
      agent_id: role === 'agent' ? cleanAgentId : null,
      agent_name: cleanAgentName,
      display_name: role === 'agent' ? cleanDisplayName || null : null,
      team: roleNeedsTeam(role) ? team : null,
      email: cleanEmail,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Profile created successfully.');
    resetForm();
    void loadProfiles();
  }

  async function handleUpdateProfile() {
    if (!editingProfileId) return;

    setErrorMessage('');
    setSuccessMessage('');

    const cleanAgentId = agentId.trim();
    const cleanAgentName = agentName.trim();
    const cleanDisplayName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanAgentName || !cleanEmail || !role) {
      setErrorMessage('Please fill Name, Email, and Role.');
      return;
    }

    if (role === 'agent' && (!cleanAgentId || !team)) {
      setErrorMessage('Please fill Agent ID and Team for an agent.');
      return;
    }

    if (role === 'supervisor' && !team) {
      setErrorMessage('Please select a Team for a supervisor.');
      return;
    }

    setSaving(true);

    const isUnique = await validateAgentUniqueness(editingProfileId);
    if (!isUnique) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        role,
        agent_id: role === 'agent' ? cleanAgentId : null,
        agent_name: cleanAgentName,
        display_name: role === 'agent' ? cleanDisplayName || null : null,
        team: roleNeedsTeam(role) ? team : null,
        email: cleanEmail,
      })
      .eq('id', editingProfileId);

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Profile updated successfully.');
    resetForm();
    void loadProfiles();
  }

  async function handleDeleteProfile(
    profileId: string,
    profileRole: ProfileRole
  ) {
    setErrorMessage('');
    setSuccessMessage('');

    if (
      profileRole === 'admin' ||
      profileRole === 'qa' ||
      profileRole === 'supervisor'
    ) {
      setErrorMessage(
        'Do not delete admin, QA, or supervisor profiles from here.'
      );
      return;
    }

    if (pendingDeleteId !== profileId) {
      setPendingDeleteId(profileId);
      setSuccessMessage('Click delete again to confirm profile removal.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (editingProfileId === profileId) {
      resetForm();
    }

    setPendingDeleteId(null);
    setProfiles((prev) => prev.filter((item) => item.id !== profileId));
    setSuccessMessage('Profile deleted successfully.');
  }

  return (
    <div data-no-theme-invert="true" style={{ color: 'var(--screen-text)', ...(themeVars as CSSProperties) }}>
      <div style={pageHeaderStyle}>
        <div>
          <div style={sectionEyebrow}>Access Management</div>
          <h2 style={{ margin: 0, fontSize: '30px' }}>Accounts</h2>
          <p style={{ margin: '10px 0 0 0', color: 'var(--screen-subtle)' }}>
            Create and manage profile rows after the user already exists in
            Supabase Authentication.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadProfiles()}
          style={secondaryButton}
        >
          Refresh Profiles
        </button>
      </div>

      {errorMessage ? <div style={errorBannerStyle}>{errorMessage}</div> : null}
      {successMessage ? (
        <div style={successBannerStyle}>{successMessage}</div>
      ) : null}

      <div style={panelStyle}>
        <h3 style={{ marginTop: 0, color: 'var(--screen-heading)' }}>
          {editingProfileId ? 'Edit Profile' : 'Create Profile'}
        </h3>

        <div style={formGridStyle}>
          <div style={wideFieldStyle}>
            <label style={labelStyle}>Auth User UUID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={Boolean(editingProfileId)}
              style={{
                ...fieldStyle,
                opacity: editingProfileId ? 0.7 : 1,
              }}
              placeholder="Paste UUID from Supabase Authentication"
            />
          </div>

          <div>
            <label style={labelStyle}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ProfileRole)}
              style={fieldStyle}
            >
              <option value="agent">Agent</option>
              <option value="qa">QA</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {roleNeedsAgentId(role) && (
            <div>
              <label style={labelStyle}>Agent ID</label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                style={fieldStyle}
                placeholder="Enter agent ID"
              />
            </div>
          )}

          {roleNeedsTeam(role) && (
            <div>
              <label style={labelStyle}>Team</label>
              <select
                value={team}
                onChange={(e) =>
                  setTeam(e.target.value as 'Calls' | 'Tickets' | 'Sales' | '')
                }
                style={fieldStyle}
              >
                <option value="">Select Team</option>
                <option value="Calls">Calls</option>
                <option value="Tickets">Tickets</option>
                <option value="Sales">Sales</option>
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              style={fieldStyle}
              placeholder="Enter full name"
            />
          </div>

          {roleNeedsDisplayName(role) && (
            <div>
              <label style={labelStyle}>Display Name / Nickname</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Example: Kurt"
                style={fieldStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={fieldStyle}
              placeholder="name@detroitaxle.com"
            />
          </div>
        </div>
      </div>

      <div style={actionRowStyle}>
        {editingProfileId ? (
          <>
            <button
              onClick={handleUpdateProfile}
              disabled={saving}
              style={primaryButton}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <button onClick={resetForm} type="button" style={secondaryButton}>
              Cancel Edit
            </button>
          </>
        ) : (
          <button
            onClick={handleCreateProfile}
            disabled={saving}
            style={primaryButton}
          >
            {saving ? 'Saving...' : 'Create Profile'}
          </button>
        )}
      </div>

      <div style={{ marginTop: '32px' }}>
        <div style={sectionEyebrow}>Saved Profiles</div>
        {loading ? (
          <p style={{ color: 'var(--screen-subtle)' }}>Loading accounts...</p>
        ) : profiles.length === 0 ? (
          <p style={{ color: 'var(--screen-subtle)' }}>No profiles found.</p>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={headerCell}>UUID</th>
                  <th style={headerCell}>Role</th>
                  <th style={headerCell}>Agent ID</th>
                  <th style={headerCell}>Name</th>
                  <th style={headerCell}>Display Name</th>
                  <th style={headerCell}>Team</th>
                  <th style={headerCell}>Email</th>
                  <th style={headerCell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td style={bodyCell}>{profile.id}</td>
                    <td style={bodyCell}>{profile.role}</td>
                    <td style={bodyCell}>{profile.agent_id || '-'}</td>
                    <td style={bodyCell}>{profile.agent_name}</td>
                    <td style={bodyCell}>{profile.display_name || '-'}</td>
                    <td style={bodyCell}>{profile.team || '-'}</td>
                    <td style={bodyCell}>{profile.email}</td>
                    <td style={bodyCell}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          onClick={() => startEditProfile(profile)}
                          style={smallPrimaryButton}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleDeleteProfile(profile.id, profile.role)
                          }
                          style={smallDangerButton}
                        >
                          {pendingDeleteId === profile.id
                            ? 'Confirm Delete'
                            : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={warningCardStyle}>
        <strong>Important:</strong> This page creates profile rows only. Real
        email and password users must still be created first in Supabase
        Authentication.
      </div>
    </div>
  );
}

const pageHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const,
  marginBottom: '20px',
};

const sectionEyebrow = {
  color: 'var(--screen-accent)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.16em',
  marginBottom: '12px',
};

const panelStyle = {
  background:
    'var(--screen-panel-bg)',
  border: '1px solid var(--screen-border)',
  borderRadius: '24px',
  padding: '22px',
  boxShadow: 'var(--screen-shadow)',
  backdropFilter: 'blur(14px)',
};

const formGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '16px',
};

const wideFieldStyle = {
  gridColumn: '1 / -1',
};

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '13px',
  color: 'var(--screen-muted)',
  fontWeight: 700,
};

const fieldStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--screen-border-strong)',
  background: 'var(--screen-field-bg)',
  color: 'var(--screen-field-text)',
};

const actionRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  marginTop: '24px',
};

const primaryButton = {
  padding: '14px 18px',
  borderRadius: '16px',
  border: '1px solid rgba(96, 165, 250, 0.24)',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 16px 32px rgba(37, 99, 235, 0.28)',
};

const secondaryButton = {
  padding: '14px 18px',
  borderRadius: '16px',
  border: '1px solid var(--screen-border-strong)',
  background: 'var(--screen-secondary-btn-bg)',
  color: 'var(--screen-secondary-btn-text)',
  fontWeight: 700,
  cursor: 'pointer',
};

const tableWrapStyle = {
  overflowX: 'auto' as const,
  borderRadius: '20px',
  border: '1px solid var(--screen-border)',
  background:
    'var(--screen-card-bg)',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  minWidth: '960px',
};

const headerCell = {
  padding: '14px 16px',
  textAlign: 'left' as const,
  whiteSpace: 'nowrap' as const,
  color: 'var(--screen-accent-soft)',
  borderBottom: '1px solid var(--screen-border)',
  backgroundColor: 'var(--screen-table-head-bg)',
};

const bodyCell = {
  padding: '14px 16px',
  verticalAlign: 'top' as const,
  color: 'var(--screen-field-text)',
  borderBottom: '1px solid var(--screen-border)',
};

const smallPrimaryButton = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(96, 165, 250, 0.24)',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
};

const smallDangerButton = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(248, 113, 113, 0.18)',
  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
};

const errorBannerStyle = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--screen-error-border)',
  background: 'var(--screen-error-bg)',
  color: 'var(--screen-error-text)',
};

const successBannerStyle = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--screen-success-border)',
  background: 'var(--screen-success-bg)',
  color: 'var(--screen-success-text)',
};

const warningCardStyle = {
  marginTop: '24px',
  borderRadius: '16px',
  padding: '16px 18px',
  border: '1px solid var(--screen-warning-border)',
  background: 'var(--screen-warning-bg)',
  color: 'var(--screen-warning-text)',
};

export default AccountsSupabase;
