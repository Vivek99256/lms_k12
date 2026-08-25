export type Department = {
  id: string
  name: string
  code: string | null
  description: string | null
  parentId: string | null
  parent: string | null
  hod: string | null
  hodId: string | null
  employees: number
  status: 'Active' | 'Inactive'
  sortOrder: number
  created: string
  updated: string | null
}

export type DeptNode = {
  id: string
  name: string
  code: string | null
  hod: string | null
  employees: number
  status: 'Active' | 'Inactive'
  sortOrder: number
  children: DeptNode[]
  orphaned?: boolean
}

export const ORG_PROFILE = {
  name: 'Organization',
}
