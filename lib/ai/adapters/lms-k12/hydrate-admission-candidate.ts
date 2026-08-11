import type { ProjectContext } from "@shared/conversational-ai-core";
import { mergeAdmissionData } from "./merge-admission-data";

export interface HydrateAdmissionInput {
  enquiryId: number;
  subInstituteId: string | number;
  academicYear: string | number;
  token?: string;
  userId?: string | number;
}

export async function hydrateAdmissionCandidate(
  input: HydrateAdmissionInput,
  services: {
    admissionApi: {
      getEnquiryDetails: (ctx: {
        enquiryId: number;
        subInstituteId: string | number;
        academicYear: string | number;
        token?: string;
      }) => Promise<Record<string, any> | null>;
      findRegistrationByEnquiryId: (ctx: {
        enquiryId: number;
        subInstituteId: string | number;
        academicYear: string | number;
        token?: string;
      }) => Promise<Record<string, any> | null>;
      getStudentByRegistrationId: (ctx: {
        registrationId: number;
        subInstituteId: string | number;
        token?: string;
      }) => Promise<Record<string, any> | null>;
    };
  },
) {
  const enquiry = await services.admissionApi.getEnquiryDetails({
    enquiryId: input.enquiryId,
    subInstituteId: input.subInstituteId,
    academicYear: input.academicYear,
    token: input.token,
  });

  if (!enquiry) {
    throw new Error("Admission enquiry record was not found.");
  }

  let registration = null;
  try {
    registration =
      await services.admissionApi.findRegistrationByEnquiryId({
        enquiryId: input.enquiryId,
        subInstituteId: input.subInstituteId,
        academicYear: input.academicYear,
        token: input.token,
      });
  } catch {
    registration = null;
  }

  let student = null;
  if (registration?.id) {
    try {
      student = await services.admissionApi.getStudentByRegistrationId({
        registrationId: registration.id,
        subInstituteId: input.subInstituteId,
        token: input.token,
      });
    } catch {
      student = null;
    }
  }

  return mergeAdmissionData({
    enquiry,
    registration,
    student,
    sessionContext: input,
  });
}
