export type Role = 'admin' | 'hr' | 'manager' | 'employee'

export function roleLabel(role: Role): string {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'hr':
      return 'HR'
    case 'manager':
      return 'Manager'
    case 'employee':
      return 'Employee'
    default:
      return 'User'
  }
}

export function getAccess(scope: string, role: Role): 'none' | 'scoped' | 'full' {
  if (role === 'admin' || role === 'hr') return 'full'
  if (role === 'manager') return 'scoped'
  return 'none'
}
