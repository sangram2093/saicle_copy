/**
 * Utility to check if a user is a DbSaicle team member
 */
export function isDbSaicleTeamMember(email?: string): boolean {
  if (!email) return false;
  return email.includes("@db.com");
}
