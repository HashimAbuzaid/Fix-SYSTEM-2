export type TeamName = 'Calls' | 'Tickets' | 'Sales';

export type AppRole = 'admin' | 'qa' | 'agent' | 'supervisor';

export type UserProfile = {
  id: string;
  role: AppRole;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
  email: string;
};

export type ProfileRole = AppRole;

export type AuditStatusShareFields = {
  shared_with_agent?: boolean | null;
  shared_at?: string | null;
};
