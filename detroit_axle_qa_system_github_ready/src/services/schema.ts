export const tableMap = {
  profiles: 'App identity, role, and team mapping',
  audits: 'QA audits and release visibility',
  calls_records: 'Calls production uploads',
  tickets_records: 'Tickets production uploads',
  sales_records: 'Sales production uploads',
  agent_feedback: 'Coaching and QA feedback items',
  monitoring_items: 'Live monitoring and operational attention items',
  supervisor_requests: 'Supervisor escalation / request workflow',
  voice_submissions: 'Anonymous employee feedback channel',
  qa_academy_lessons: 'Team learning content and lesson library',
} as const;

export type AppTableName = keyof typeof tableMap;
