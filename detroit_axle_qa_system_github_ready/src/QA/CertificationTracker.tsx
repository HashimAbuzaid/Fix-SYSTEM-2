import { memo } from 'react';
import type { UserRole } from './TrainingModule';

export type CertificationRecord = {
  id: string;
  name: string;
  description: string;
  status: 'not-started' | 'in-progress' | 'certified' | 'expired';
  progress: number;
  requiredRole: UserRole;
  expiresAt?: string | null;
};

type CertificationTrackerProps = {
  certifications: CertificationRecord[];
  role: UserRole;
};

function getStatusText(status: CertificationRecord['status']) {
  if (status === 'not-started') return 'Not Started';
  if (status === 'in-progress') return 'In Progress';
  if (status === 'certified') return 'Certified';
  return 'Expired';
}

function CertificationTracker({ certifications, role }: CertificationTrackerProps) {
  const visible = certifications.filter((certification) =>
    certification.requiredRole === role ||
    certification.requiredRole === 'agent' ||
    role === 'admin' ||
    role === 'qa'
  );

  if (!visible.length) {
    return <div className="lc-empty">No certifications are assigned yet.</div>;
  }

  return (
    <section className="lc-card lc-card-pad">
      <h2 className="lc-section-title">Certification Tracking</h2>
      <div className="lc-grid">
        {visible.map((certification) => (
          <article className="lc-card lc-card-pad lc-span-6" key={certification.id}>
            <div className="lc-pill-row" style={{ marginBottom: 10 }}>
              <span className="lc-pill">{getStatusText(certification.status)}</span>
              <span className="lc-pill">{certification.requiredRole}</span>
              {certification.expiresAt && <span className="lc-pill">{certification.expiresAt}</span>}
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 850, letterSpacing: '-0.02em' }}>
              {certification.name}
            </h3>
            <p className="lc-mini-copy" style={{ marginTop: 7 }}>{certification.description}</p>
            <div style={{
              height: 7,
              borderRadius: 999,
              background: 'var(--lc-soft)',
              border: '1px solid var(--lc-border)',
              overflow: 'hidden',
              marginTop: 14,
            }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, certification.progress))}%`,
                  background: certification.status === 'certified' ? 'var(--lc-success)' : 'var(--lc-accent)',
                  borderRadius: 999,
                  transition: 'width 240ms var(--ease-out, ease)',
                }}
              />
            </div>
            <div className="lc-kpi-note">{certification.progress}% complete</div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default memo(CertificationTracker);
