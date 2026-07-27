import StudentCareModule from '../_components/StudentCareModule';
export default function Page() {
  return <StudentCareModule config={{ module: 'height-weight', title: 'Student Height Weight', singular: 'Height Weight', fields: [
    { key: 'doctor_name', label: 'Doctor Name' }, { key: 'doctor_contact', label: 'Doctor Contact' },
    { key: 'date', label: 'Date', type: 'date', required: true }, { key: 'height', label: 'Height', type: 'number' },
    { key: 'weight', label: 'Weight', type: 'number' },
  ] }} />;
}
