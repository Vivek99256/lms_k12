'use client';
<<<<<<< HEAD
import { ServerCog } from 'lucide-react';
import MasterPage from '../_components/MasterPage';
export default function Page() { return <MasterPage config={{ kind: 'smtp', title: 'SMTP', description: 'Configure outgoing email server credentials and test delivery.', icon: ServerCog, path: 'settings/smtp_setting', testEmail: true, fields: [{ key: 'email', label: 'Email', type: 'email', required: true }, { key: 'password', label: 'Password', type: 'password', required: true }, { key: 'server_address', label: 'Server Address', required: true }, { key: 'port', label: 'Port', type: 'number', required: true }], columns: [{ key: 'gmail', label: 'Email' }, { key: 'password', label: 'Password' }, { key: 'server_address', label: 'Server Address' }, { key: 'port', label: 'Port' }] }} />; }
=======

import { ServerCog } from 'lucide-react';
import MasterPage from '../_components/MasterPage';

export default function Page() {
  return (
    <MasterPage
      config={{
        kind: 'smtp',
        title: 'SMTP Email',
        description: 'Configure the outgoing mail server used for parent emails, and test delivery.',
        icon: ServerCog,
        path: 'smtp',
        testPath: 'smtp/test',
        entityLabel: 'SMTP configuration',
        singleton: true,
        fields: [
          { key: 'email', label: 'Email', type: 'email', required: true },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            required: true,
            secret: true,
            secretFlag: 'has_password',
          },
          { key: 'server_address', label: 'Server address', required: true, helpText: 'e.g. smtp.gmail.com' },
          { key: 'port', label: 'Port', type: 'number', required: true, helpText: '465 for SSL, 587 for TLS.' },
        ],
        columns: [
          { key: 'email', label: 'Email' },
          { key: 'server_address', label: 'Server address' },
          { key: 'port', label: 'Port' },
          { key: 'has_password', label: 'Password saved' },
        ],
      }}
    />
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
