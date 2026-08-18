'use client';

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
