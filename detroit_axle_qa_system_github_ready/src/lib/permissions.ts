import type { AppRole, UserProfile } from '../types/app';
export function isAdmin(role?: AppRole | null) {
  return role === 'admin';
}
export function isQA(role?: AppRole | null) {
  return role === 'qa';
}
export function isSupervisor(role?: AppRole | null) {
  return role === 'supervisor';
}
export function isAgent(role?: AppRole | null) {
  return role === 'agent';
}
export function isStaffRole(role?: AppRole | null) {
  return role === 'admin' || role === 'qa';
}
export function canManageAccounts(role?: AppRole | null) {
  return isAdmin(role);
}
export function canManageAudits(role?: AppRole | null) {
  return isAdmin(role) || isQA(role);
}
export function canDeleteAudits(role?: AppRole | null) {
  return isAdmin(role);
}
export function canManageSupervisorRequests(role?: AppRole | null) {
  return isAdmin(role) || isSupervisor(role);
}
export function canReviewSupervisorRequests(role?: AppRole | null) {
  return isAdmin(role) || isQA(role);
}
export function canManageFeedback(role?: AppRole | null) {
  return isAdmin(role) || isQA(role);
}
export function canOpenStaffWorkspace(profile?: Pick<UserProfile, 'role'> | null) {
  return isStaffRole(profile?.role);
}
export function canAccess(profile: UserProfile | null) {
  return profile?.is_active !== false;
}