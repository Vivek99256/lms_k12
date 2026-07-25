export type SqaaLevel = {
  id: string;
  title: string;
  description: string;
  parentId: string;
  level: number;
  sortOrder: number;
};

export type SqaaHierarchySelection = {
  level1: string;
  level2: string;
  level3: string;
  level4: string;
};

export type SqaaDocumentRow = {
  id: string;
  menuId: string;
  menuTitle: string;
  documentTitle: string;
  availability: string;
  file: string;
};

export type SqaaDocumentReport = {
  rows: SqaaDocumentRow[];
  level1: SqaaLevel[];
};

export type SqaaEntryDocument = {
  documentId: string;
  entryId: string;
  menuId: string;
  title: string;
  reasons: string;
  availability: '' | 'yes' | 'no' | 'inprocess';
  file: string;
};

export type SqaaEntryData = {
  mark: number | null;
  documents: SqaaEntryDocument[];
};

export const emptySqaaSelection = (): SqaaHierarchySelection => ({
  level1: '',
  level2: '',
  level3: '',
  level4: '',
});
