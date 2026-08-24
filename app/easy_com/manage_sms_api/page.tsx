'use client';
<<<<<<< HEAD
import { RadioTower } from 'lucide-react';
import MasterPage from '../_components/MasterPage';
export default function Page() { return <MasterPage config={{ kind: 'sms-api', title: 'SMS API Master', description: 'Configure the institute SMS gateway URL and parameters.', icon: RadioTower, path: 'easy_com/manage_sms_api', fields: [{ key: 'url', label: 'URL', required: true }, { key: 'pram', label: 'Parameter', required: true }, { key: 'mobile_var', label: 'Mobile Variable', required: true }, { key: 'text_var', label: 'Text Variable', required: true }, { key: 'last_var', label: 'Last Variable', required: true }], columns: [{ key: 'url', label: 'URL' }, { key: 'pram', label: 'Parameter' }, { key: 'mobile_var', label: 'Mobile Variable' }, { key: 'text_var', label: 'Text Variable' }, { key: 'last_var', label: 'Last Variable' }] }} />; }
=======

import { RadioTower } from 'lucide-react';
import MasterPage from '../_components/MasterPage';

export default function Page() {
  return (
    <MasterPage
      config={{
        kind: 'sms-api',
        title: 'SMS API Master',
        description: 'Configure the institute SMS gateway URL and its request parameters.',
        icon: RadioTower,
        path: 'sms-api',
        entityLabel: 'SMS gateway',
        singleton: true,
        fields: [
          {
            key: 'url',
            label: 'URL',
            required: true,
            wide: true,
            helpText: 'Gateway endpoint, e.g. https://sms.provider.com/API/SendSMS.aspx?',
          },
          {
            key: 'pram',
            label: 'Parameter',
            required: true,
            wide: true,
            helpText: 'Static query string: credentials, sender id, message type.',
          },
          { key: 'mobile_var', label: 'Mobile variable', required: true, helpText: 'e.g. &PhoneNumber=' },
          { key: 'text_var', label: 'Text variable', required: true, helpText: 'e.g. &Text=' },
          { key: 'last_var', label: 'Last variable', wide: true, helpText: 'Appended last, e.g. &templateid=…' },
        ],
        columns: [
          { key: 'url', label: 'URL', wide: true },
          { key: 'pram', label: 'Parameter', wide: true },
          { key: 'mobile_var', label: 'Mobile variable' },
          { key: 'text_var', label: 'Text variable' },
          { key: 'last_var', label: 'Last variable' },
        ],
      }}
    />
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
