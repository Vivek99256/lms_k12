export function buildRegistrationPayloadFromEnquiry(
  data: Record<string, any>,
) {
  return {
    enquiry_id: data.enquiryId,
    enquiry_no: data.enquiryNo,
    first_name: data.firstName,
    middle_name: data.middleName,
    last_name: data.lastName,
    mobile: data.mobile,
    email: data.email,
    dob: data.dateOfBirth,
    gender: data.gender,
    address: data.address,
    standard_id: data.standardId,
    division_id: data.divisionId,
    student_quota_id: data.studentQuotaId,
    admission_date: data.admissionDate,
    sub_institute_id: data.subInstituteId,
    syear: data.academicYear,
  };
}

export function buildAdmissionConfirmationPayload(
  data: Record<string, any>,
) {
  return {
    enquiry_id: data.enquiryId,
    registration_id: data.registrationId,
    first_name: data.firstName,
    middle_name: data.middleName,
    last_name: data.lastName,
    mobile: data.mobile,
    email: data.email,
    dob: data.dateOfBirth,
    gender: data.gender,
    address: data.address,
    standard_id: data.standardId,
    division_id: data.divisionId,
    student_quota_id: data.studentQuotaId,
    admission_date: data.admissionDate,
    sub_institute_id: data.subInstituteId,
    syear: data.academicYear,
  };
}
