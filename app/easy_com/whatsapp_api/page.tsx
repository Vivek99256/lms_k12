'use client';
<<<<<<< HEAD
import { KeyRound } from 'lucide-react';
import MasterPage from '../_components/MasterPage';
export default function Page() { return <MasterPage config={{ kind: 'whatsapp-api', title: 'WhatsApp API', description: 'Configure WhatsApp Cloud API credentials.', icon: KeyRound, path: 'whatsapp-user-details', createPath: 'whatsapp-user-details/store', fields: [{ key: 'user_whatsapp_no', label: 'WhatsApp Number', required: true }, { key: 'cloud_api_access_token', label: 'Access Token', type: 'password', required: true }, { key: 'cloud_api_phone_number_id', label: 'Phone Number ID', required: true }], columns: [{ key: 'user_whatsapp_no', label: 'WhatsApp Number' }, { key: 'cloud_api_access_token', label: 'Access Token' }, { key: 'cloud_api_phone_number_id', label: 'Phone Number ID' }, { key: 'created_by_name', label: 'Created By' }] }} />; }
=======

import { KeyRound } from 'lucide-react';
import MasterPage from '../_components/MasterPage';

export default function Page() {
  return (
    <MasterPage
      config={{
        kind: 'whatsapp-api',
        title: 'WhatsApp API',
        description: 'Configure the WhatsApp Cloud API credentials used to message parents.',
        icon: KeyRound,
        path: 'whatsapp-api',
        entityLabel: 'WhatsApp configuration',
        singleton: true,
        fields: [
          { key: 'user_whatsapp_no', label: 'WhatsApp number', required: true, helpText: 'Business number with country code.' },
          {
            key: 'cloud_api_access_token',
            label: 'Access token',
            type: 'password',
            required: true,
            wide: true,
            secret: true,
            secretFlag: 'has_access_token',
          },
          { key: 'cloud_api_phone_number_id', label: 'Phone number ID', required: true },
        ],
        columns: [
          { key: 'user_whatsapp_no', label: 'WhatsApp number' },
          { key: 'cloud_api_phone_number_id', label: 'Phone number ID' },
          { key: 'cloud_api_access_token', label: 'Access token' },
          { key: 'created_by_name', label: 'Created by' },
        ],
      }}
    />
  );
}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
