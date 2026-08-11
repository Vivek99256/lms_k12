import StudentCareModule from '../_components/StudentCareModule';
export default function Page() {
  return <StudentCareModule config={{ module: 'discipline', title: 'Student Discipline', singular: 'Discipline', fields: [
    { key: 'dicipline', label: 'Discipline Type', type: 'select', required: true, options: [
      { value: 'Bad', label: 'Bad' }, { value: 'Good', label: 'Good' }, { value: 'Check', label: 'Check' }, { value: 'Excellent', label: 'Excellent' },
    ] }, { key: 'message', label: 'Message', type: 'textarea', required: true },
    { key: 'flag', label: 'Flag', type: 'select', options: [
      { value: '1', label: 'Positive' }, { value: '0', label: 'Neutral' }, { value: '-1', label: 'Negative' },
    ] }, { key: 'date_', label: 'Date', type: 'date', required: true },
  ] }} />;
}
