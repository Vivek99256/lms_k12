type AnyRecord = Record<string, any>;

function firstAvailable<T>(
  ...values: Array<T | null | undefined | "">
): T | undefined {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  ) as T | undefined;
}

export function mergeAdmissionData(input: {
  enquiry: AnyRecord;
  registration?: AnyRecord | null;
  student?: AnyRecord | null;
  sessionContext: AnyRecord;
}) {
  const { enquiry, registration, student, sessionContext } = input;

  return {
    enquiryId: firstAvailable(
      registration?.enquiry_id,
      enquiry?.id,
      enquiry?.enquiry_id,
    ),

    registrationId: firstAvailable(
      registration?.id,
      registration?.registration_id,
    ),

    studentId: firstAvailable(student?.id, student?.student_id),

    enquiryNo: firstAvailable(
      registration?.enquiry_no,
      enquiry?.enquiry_no,
      enquiry?.enquiry_number,
    ),

    firstName: firstAvailable(
      registration?.first_name,
      enquiry?.first_name,
      student?.first_name,
    ),

    middleName: firstAvailable(
      registration?.middle_name,
      enquiry?.middle_name,
      student?.middle_name,
    ),

    lastName: firstAvailable(
      registration?.last_name,
      enquiry?.last_name,
      student?.last_name,
    ),

    fullName: firstAvailable(
      registration?.full_name,
      enquiry?.full_name,
      student?.full_name,
      [
        firstAvailable(
          registration?.first_name,
          enquiry?.first_name,
          student?.first_name,
        ),
        firstAvailable(
          registration?.middle_name,
          enquiry?.middle_name,
          student?.middle_name,
        ),
        firstAvailable(
          registration?.last_name,
          enquiry?.last_name,
          student?.last_name,
        ),
      ]
        .filter(Boolean)
        .join(" "),
    ),

    mobile: firstAvailable(
      registration?.mobile,
      registration?.mobile_no,
      enquiry?.mobile,
      enquiry?.mobile_no,
      student?.mobile,
    ),

    email: firstAvailable(
      registration?.email,
      enquiry?.email,
      student?.email,
    ),

    dateOfBirth: firstAvailable(
      registration?.date_of_birth,
      registration?.dob,
      enquiry?.date_of_birth,
      enquiry?.dob,
      student?.date_of_birth,
      student?.dob,
    ),

    gender: firstAvailable(
      registration?.gender,
      enquiry?.gender,
      student?.gender,
    ),

    address: firstAvailable(
      registration?.address,
      enquiry?.address,
      student?.address,
    ),

    standardId: firstAvailable(
      registration?.standard_id,
      enquiry?.standard_id,
      student?.standard_id,
    ),

    standardName: firstAvailable(
      registration?.standard_name,
      enquiry?.standard_name,
      student?.standard_name,
    ),

    divisionId: firstAvailable(
      registration?.division_id,
      student?.division_id,
    ),

    divisionName: firstAvailable(
      registration?.division_name,
      student?.division_name,
    ),

    studentQuotaId: firstAvailable(
      registration?.student_quota_id,
      registration?.quota_id,
      student?.student_quota_id,
    ),

    studentQuotaName: firstAvailable(
      registration?.student_quota_name,
      registration?.quota_name,
      student?.student_quota_name,
    ),

    admissionDate: firstAvailable(
      registration?.admission_date,
      student?.admission_date,
    ),

    status: firstAvailable(
      registration?.status,
      enquiry?.status,
      student?.status,
    ),

    subInstituteId: firstAvailable(
      registration?.sub_institute_id,
      enquiry?.sub_institute_id,
      student?.sub_institute_id,
      sessionContext?.subInstituteId,
    ),

    academicYear: firstAvailable(
      registration?.syear,
      enquiry?.syear,
      student?.syear,
      sessionContext?.academicYear,
    ),

    raw: {
      enquiry,
      registration,
      student,
    },
  };
}
