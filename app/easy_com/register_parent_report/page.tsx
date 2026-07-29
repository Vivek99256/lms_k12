'use client';
import { UserCheck } from 'lucide-react';
import ReportPage from '../_components/ReportPage';
export default function Page() { return <ReportPage config={{ kind: 'register-parent', title: 'Register Parent Report', description: 'Review registered parent devices and mobile numbers.', icon: UserCheck, path: 'easy_com/register_parents_report', mobile: true, columns: [{ key: 'student_name', label: 'Student Name' }, { key: 'mobile_no', label: 'Mobile' }, { key: 'imei_no', label: 'IMEI No.' }, { key: 'device_id', label: 'Device ID' }, { key: 'created_at', label: 'Registered On' }] }} />; }
