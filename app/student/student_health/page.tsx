import StudentCareModule from '../_components/StudentCareModule';
export default function Page() {
  return <StudentCareModule config={{ module: 'health', title: 'Student Health', singular: 'Health Record', fields: [
    { key: 'doctor_name', label: 'Doctor Name' }, { key: 'doctor_contact', label: 'Doctor Contact' },
    { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'remarks', label: 'Remarks', type: 'textarea' },
    { key: 'file', label: 'Document', type: 'file' },
  ] }} />;
}
