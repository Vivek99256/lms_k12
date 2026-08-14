'use client';

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
