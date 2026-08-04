export type RegisterKind = 'inward' | 'outward';

export type Place = {
  id: string;
  title: string;
  description: string;
};

export type PhysicalFileLocation = Place & {
  fileCode: string;
  fileLocation: string;
};

export type RegisterEntry = {
  id: string;
  placeId: string;
  placeName: string;
  fileLocationId: string;
  fileName: string;
  fileLocation: string;
  number: string;
  title: string;
  description: string;
  attachment: string;
  academicYear: string;
  syear: string;
  date: string;
};

export type Feedback = {
  type: 'success' | 'error' | 'info';
  text: string;
};
