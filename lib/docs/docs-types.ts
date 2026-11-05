export interface DocVersionMeta {
  version: string;
  label: string;
  isLatest?: boolean;
  releaseDate?: string;
  description: string;
}

// Right now only one version is available: 1.0.0 (mapped to /docs/v1/)
export const AVAILABLE_VERSIONS: DocVersionMeta[] = [
  {
    version: "1.0.0",
    label: "v1.0.0 (Latest)",
    isLatest: true,
    releaseDate: "2026-11-04",
    description: "Scholar Suite v1 Product Bible: ERP, LMS, CCB, Insight, and Compass specs.",
  },
];

export interface DocNavItem {
  title: string;
  slug: string;
  path: string;
  href: string;
  isIndex?: boolean;
  children?: DocNavItem[];
}

export interface DocTocItem {
  id: string;
  text: string;
  level: number;
}

export interface DocPageData {
  title: string;
  description?: string;
  version: string;
  slug: string[];
  htmlContent: string;
  toc: DocTocItem[];
  meta: Record<string, any>;
  prevDoc?: { title: string; href: string } | null;
  nextDoc?: { title: string; href: string } | null;
}

export interface SearchDocResult {
  title: string;
  version: string;
  href: string;
  excerpt: string;
  category: string;
}

