export function normalizeRoleName(value?: string) {
  return (value || "").trim().toLowerCase();
}

export function isStudentProfile(value?: string) {
  const role = normalizeRoleName(value);
  return role.includes("student");
}

export function isTeacherProfile(value?: string) {
  const role = normalizeRoleName(value);
  return role.includes("teacher");
}

export function isAdminProfile(value?: string) {
  const role = normalizeRoleName(value);
  return (
    role.includes("admin") ||
    role.includes("principal") ||
    role.includes("super") ||
    role.includes("management")
  );
}

export function canAccessStudentAnalytics(value?: string) {
  return isTeacherProfile(value) || isAdminProfile(value) || isStudentProfile(value);
}
