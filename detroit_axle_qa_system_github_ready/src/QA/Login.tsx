import { useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

const LOGO_MARK_SRC = '/detroit-axle-mark.png';
const LOGO_WORDMARK_SRC = '/detroit-axle-wordmark.svg';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleLogin() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!email || !password) {
      setErrorMessage('Please enter email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleForgotPassword() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!email) {
      setErrorMessage('Enter your email first, then click Forgot password.');
      return;
    }

    setSendingRecovery(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    setSendingRecovery(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Password recovery email sent. Open the email link to set a new password.');
  }

  return (
    <div style={shellStyle}>
      <div style={glowTopStyle} />
      <div style={glowBottomStyle} />

      <div style={layoutStyle}>
        <div style={brandPanelStyle}>
          <div style={brandHeaderStyle}>
            <div style={logoWrapStyle}>
              <div style={logoInnerStyle}>
                <img src={LOGO_MARK_SRC} alt="Detroit Axle mark" style={logoStyle} />
              </div>
            </div>
            <div style={brandHeaderTextStyle}>
              <div style={eyebrowStyle}>Detroit Axle Workspace</div>
              <img src={LOGO_WORDMARK_SRC} alt="Detroit Axle" style={wordmarkStyle} />
            </div>
          </div>
          <h1 style={brandTitleStyle}>QA Command Center</h1>
          <p style={brandCopyStyle}>
            One workspace for audits, team volume, recognition, monitoring, and coaching.
          </p>
          <div style={featureListStyle}>
            <div style={featureItemStyle}>Live quality dashboards by role</div>
            <div style={featureItemStyle}>Recognition, monitoring, and coaching in one place</div>
            <div style={featureItemStyle}>Fast entry into your team workspace</div>
          </div>
        </div>

        <div style={loginCardStyle}>
          <div style={eyebrowDarkStyle}>Secure Access</div>
          <h2 style={titleStyle}>Sign in to Detroit Axle QA</h2>
          <p style={subtitleStyle}>Use your Detroit Axle email and password to continue.</p>

          {errorMessage ? <div style={errorBannerStyle}>{errorMessage}</div> : null}
          {successMessage ? <div style={successBannerStyle}>{successMessage}</div> : null}

          <form
            style={formStyle}
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@detroitaxle.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={inputStyle}
              />
            </div>

            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? 'Logging in...' : 'Login'}
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={sendingRecovery}
              style={secondaryButtonStyle}
            >
              {sendingRecovery ? 'Sending recovery...' : 'Forgot password?'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '28px',
  background:
    'radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 26%), radial-gradient(circle at bottom right, rgba(168,85,247,0.16), transparent 28%), linear-gradient(180deg, #07111f 0%, #0b1324 100%)',
  position: 'relative',
  overflow: 'hidden',
};
const glowTopStyle: CSSProperties = { position: 'absolute', top: '-140px', left: '-120px', width: '380px', height: '380px', background: 'radial-gradient(circle, rgba(37,99,235,0.24) 0%, transparent 72%)' };
const glowBottomStyle: CSSProperties = { position: 'absolute', right: '-120px', bottom: '-150px', width: '380px', height: '380px', background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 72%)' };
const layoutStyle: CSSProperties = {
  width: '100%',
  maxWidth: '1120px',
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 0.98fr) minmax(380px, 0.85fr)',
  gap: '24px',
  alignItems: 'stretch',
};
const sharedPanel: CSSProperties = {
  borderRadius: '30px',
  border: '1px solid rgba(148,163,184,0.16)',
  boxShadow: '0 24px 64px rgba(2,6,23,0.4)',
  backdropFilter: 'blur(18px)',
};
const brandPanelStyle: CSSProperties = { ...sharedPanel, background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.72) 100%)', padding: '32px', color: '#e5eefb', display: 'grid', alignContent: 'start', gap: '18px' };
const brandHeaderStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: '16px', alignItems: 'center' };
const logoWrapStyle: CSSProperties = { width: '96px', height: '96px', borderRadius: '28px', background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(148,163,184,0.16)', display: 'grid', placeItems: 'center', boxShadow: '0 18px 44px rgba(2,6,23,0.32)', padding: '4px' };
const logoInnerStyle: CSSProperties = { width: '100%', height: '100%', borderRadius: '20px', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)', overflow: 'hidden' };
const logoStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.08)' };
const brandHeaderTextStyle: CSSProperties = { display: 'grid', gap: '8px', minWidth: 0 };
const wordmarkStyle: CSSProperties = { width: '100%', maxWidth: '360px', height: '48px', objectFit: 'contain', objectPosition: 'left center' };
const eyebrowStyle: CSSProperties = { color: '#93c5fd', fontSize: '12px', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' };
const eyebrowDarkStyle: CSSProperties = { color: '#60a5fa', fontSize: '12px', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' };
const brandTitleStyle: CSSProperties = { margin: 0, fontSize: '38px', lineHeight: 1.05, color: '#f8fafc', fontWeight: 900 };
const brandCopyStyle: CSSProperties = { margin: 0, color: '#cbd5e1', lineHeight: 1.7, fontSize: '15px' };
const featureListStyle: CSSProperties = { display: 'grid', gap: '10px', marginTop: '8px' };
const featureItemStyle: CSSProperties = { padding: '14px 16px', borderRadius: '18px', border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(15,23,42,0.48)', color: '#dbeafe', fontWeight: 700, lineHeight: 1.5 };
const loginCardStyle: CSSProperties = { ...sharedPanel, background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.96) 100%)', padding: '32px', color: '#0f172a' };
const titleStyle: CSSProperties = { margin: '8px 0 8px 0', fontSize: '34px', lineHeight: 1.08, color: '#0f172a', fontWeight: 900 };
const subtitleStyle: CSSProperties = { margin: '0 0 20px 0', color: '#64748b', lineHeight: 1.6 };
const formStyle: CSSProperties = { display: 'grid', gap: '16px' };
const labelStyle: CSSProperties = { display: 'block', marginBottom: '8px', fontWeight: 700, color: '#475569' };
const inputStyle: CSSProperties = { width: '100%', padding: '16px 18px', borderRadius: '18px', border: '1px solid rgba(203,213,225,0.92)', background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.98) 100%)', color: '#0f172a', boxSizing: 'border-box' };
const buttonStyle: CSSProperties = { padding: '15px 18px', borderRadius: '18px', border: '1px solid rgba(96,165,250,0.24)', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 18px 32px rgba(37,99,235,0.22)' };
const secondaryButtonStyle: CSSProperties = { padding: '15px 18px', borderRadius: '18px', border: '1px solid rgba(203,213,225,0.92)', background: 'rgba(255,255,255,0.92)', color: '#334155', fontWeight: 700, cursor: 'pointer' };
const errorBannerStyle: CSSProperties = { marginBottom: '16px', padding: '13px 16px', borderRadius: '16px', background: 'rgba(254,242,242,0.98)', border: '1px solid rgba(248,113,113,0.24)', color: '#b91c1c', fontWeight: 700 };
const successBannerStyle: CSSProperties = { marginBottom: '16px', padding: '13px 16px', borderRadius: '16px', background: 'rgba(240,253,244,0.98)', border: '1px solid rgba(74,222,128,0.24)', color: '#166534', fontWeight: 700 };

export default Login;
