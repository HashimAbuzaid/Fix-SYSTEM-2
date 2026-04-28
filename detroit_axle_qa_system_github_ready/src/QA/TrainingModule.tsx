import { memo, useState } from 'react';

export type TeamName = 'Calls' | 'Tickets' | 'Sales' | 'All';
export type UserRole = 'admin' | 'qa' | 'supervisor' | 'agent';
export type LearningStatus = 'available' | 'assigned' | 'in-progress' | 'completed' | 'overdue' | 'recommended';

export type LearningContentItem = {
  id: string;
  type: 'training' | 'sop' | 'work-instruction' | 'defect' | 'standard' | 'onboarding' | 'lesson' | 'best-practice';
  title: string;
  summary: string;
  body: string;
  team: TeamName;
  role: UserRole;
  metric?: string | null;
  durationMinutes?: number | null;
  xp: number;
  status: LearningStatus;
  dueDate?: string | null;
  version?: string | null;
  author?: string | null;
  updatedAt?: string | null;
  videoUrl?: string | null;
  steps?: string[];
  defectExample?: string | null;
  correctBehavior?: string | null;
};

type TrainingModuleProps = {
  item: LearningContentItem;
  compact?: boolean;
  onComplete?: (id: string) => void;
};

function getTypeLabel(type: LearningContentItem['type']) {
  const labels: Record<LearningContentItem['type'], string> = {
    training: 'Training Module',
    sop: 'SOP',
    'work-instruction': 'Work Instruction',
    defect: 'Defect Example',
    standard: 'Quality Standard',
    onboarding: 'Onboarding',
    lesson: 'Lesson Learned',
    'best-practice': 'Best Practice',
  };
  return labels[type];
}

function getStatusLabel(status: LearningStatus) {
  const labels: Record<LearningStatus, string> = {
    available: 'Available',
    assigned: 'Assigned',
    'in-progress': 'In Progress',
    completed: 'Completed',
    overdue: 'Overdue',
    recommended: 'Recommended',
  };
  return labels[status];
}

function TrainingModule({ item, compact = false, onComplete }: TrainingModuleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="lc-card lc-card-pad" style={{ height: '100%' }}>
      <div className="lc-pill-row" style={{ marginBottom: 10 }}>
        <span className="lc-pill">{getTypeLabel(item.type)}</span>
        <span className="lc-pill">{item.team}</span>
        <span className="lc-pill">{getStatusLabel(item.status)}</span>
        {item.metric && <span className="lc-pill">{item.metric}</span>}
      </div>

      <h3 style={{ margin: 0, fontSize: compact ? 14 : 17, fontWeight: 850, letterSpacing: '-0.025em' }}>
        {item.title}
      </h3>
      <p className="lc-mini-copy" style={{ marginTop: 7 }}>
        {item.summary}
      </p>

      {!compact && (
        <div className="lc-pill-row" style={{ marginTop: 12 }}>
          {item.durationMinutes ? <span className="lc-pill">{item.durationMinutes} min</span> : null}
          <span className="lc-pill">{item.xp} XP</span>
          {item.version ? <span className="lc-pill">{item.version}</span> : null}
          {item.dueDate ? <span className="lc-pill">Due: {item.dueDate}</span> : null}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 14 }}>
          <p className="lc-mini-copy">{item.body}</p>

          {item.steps && item.steps.length > 0 && (
            <div className="lc-list" style={{ marginTop: 12 }}>
              {item.steps.map((step, index) => (
                <div className="lc-mini-row" key={`${item.id}-step-${step}`}>
                  <div className="lc-mini-icon">{index + 1}</div>
                  <div className="lc-mini-copy">{step}</div>
                </div>
              ))}
            </div>
          )}

          {item.defectExample && (
            <div className="lc-two-col" style={{ marginTop: 12 }}>
              <div className="lc-mini-row">
                <div className="lc-mini-icon">!</div>
                <div>
                  <div className="lc-mini-title">What went wrong</div>
                  <div className="lc-mini-copy">{item.defectExample}</div>
                </div>
              </div>
              <div className="lc-mini-row">
                <div className="lc-mini-icon">✓</div>
                <div>
                  <div className="lc-mini-title">Correct behavior</div>
                  <div className="lc-mini-copy">{item.correctBehavior || 'Follow the documented standard.'}</div>
                </div>
              </div>
            </div>
          )}

          {item.videoUrl && (
            <a className="lc-btn" href={item.videoUrl} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
              Open video
            </a>
          )}
        </div>
      )}

      <div className="lc-pill-row" style={{ marginTop: 14 }}>
        <button type="button" className="lc-btn" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Collapse' : 'Open'}
        </button>
        {item.status !== 'completed' && onComplete && (
          <button type="button" className="lc-btn lc-btn-primary" onClick={() => onComplete(item.id)}>
            Mark complete
          </button>
        )}
      </div>
    </article>
  );
}

export default memo(TrainingModule);
