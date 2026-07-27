import StudentCareModule from '../_components/StudentCareModule';
export default function Page() {
  return <StudentCareModule config={{ module: 'vaccination', title: 'Student Vaccination', singular: 'Vaccination', fields: [
    { key: 'doctor_name', label: 'Doctor Name' }, { key: 'doctor_contact', label: 'Doctor Contact' },
    { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'vaccination_type', label: 'Vaccination Type' },
    { key: 'note', label: 'Note', type: 'textarea' },
  ] }} />;
}
