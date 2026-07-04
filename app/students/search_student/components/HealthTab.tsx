'use client';

import React from 'react';
import { Heart } from 'lucide-react';

export function HealthTab() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
        <Heart className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Health & medical</h3>
      <p className="text-gray-500">This section is under development</p>
    </div>
  );
}
