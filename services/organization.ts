export { organizationService } from '@/components/domain/organization/department-management/organization-service'
export type {
  Department,
  DeptNode,
  DepartmentImpact,
  DepartmentEmployee,
  DepartmentJobRole,
  DepartmentsManagementResponse,
  DepartmentDetail,
} from '@/components/domain/organization/department-management/types'
// `organization-service.ts` never exported types under these names (they
// live in `./types` as `Department`/`DepartmentEmployee`) - aliased here so
// existing imports of the old G2G-style names keep resolving.
export type {
  Department as LaravelDepartment,
  DepartmentEmployee as LaravelDepartmentEmployee,
} from '@/components/domain/organization/department-management/types'
