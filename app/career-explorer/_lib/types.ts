export interface ClusterItem {
  career_id?: string | number;
  career_cluster?: string;
  career_pathway?: string;
  image?: string;
  children?: ClusterItem[];
  // Leaf/occupation-level nodes (no image, no children) carry these instead.
  onetsoc_code?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export interface SideMenuLeaf {
  element_name: string;
  element_type: string;
  element_id: string | number;
  children?: SideMenuLeaf[];
}

export type SideMenuSection = SideMenuLeaf;

export interface ResultItem {
  title?: string;
  description?: string;
  onetsoc_code?: string;
  code?: string;
  [key: string]: unknown;
}

export type SelectedFilters = Record<string, Array<string | number>>;

export interface InstituteItem {
  id?: string | number;
  college_name?: string;
  description?: string;
  aicte_id?: string;
  type?: string;
  level?: string;
  address?: string;
  district?: string;
  state?: string;
  image?: string;
  women?: string;
  minority?: string;
  [key: string]: unknown;
}

export interface CourseItem {
  institute_id?: string;
  description?: string;
  programme?: string;
  course_level?: string;
  course_name?: string;
  course_type?: string;
  course_fees?: string | number;
  institute_data?: InstituteItem[];
  [key: string]: unknown;
}

export interface OccupationLeafDetail {
  level?: number;
  element_name?: string;
  description?: string;
  percentage?: number;
}

export interface OccupationSubSection {
  level?: number;
  sub_title?: string;
  sub_description?: string;
  children?: OccupationLeafDetail[];
}

export interface OccupationMainSection {
  level?: number;
  main_id?: number;
  main_title?: string;
  main_description?: string;
  children?: OccupationSubSection[];
}

export interface EmployerItem {
  profile?: string;
  company_logo?: string;
  category?: string;
  description?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  type?: string;
  created_at?: string;
  duration?: string;
  stipend?: string;
  [key: string]: unknown;
}
