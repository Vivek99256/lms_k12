'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { useAuth } from '@/contexts/AuthContext';
import { buildMenuTree, type ApiMenuGroups, type ApiMenuItem } from '@/app/data/menuMappers';
import { MenuItem } from '@/app/data/menuItems';

interface MenuContextPayload {
  sub_institute_id: number;
  user_id: number;
  user_profile_name: string;
  user_profile_id: number;
  client_id: number;
}

type MenuRightsResponse = {
   status?: number;
   data?: {
     'level 1'?: ApiMenuItem[] | Record<string, ApiMenuItem>;
     'level 2'?: ApiMenuGroups;
     'level 3'?: ApiMenuGroups;
   };
   'level 1'?: ApiMenuItem[] | Record<string, ApiMenuItem>;
   'level 2'?: ApiMenuGroups;
   'level 3'?: ApiMenuGroups;
   message?: string;
 };

function readNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function getValueFromObject(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined;

  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] != null && record[key] !== '') return record[key];
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const nestedValue = getValueFromObject(value, keys);
      if (nestedValue != null && nestedValue !== '') return nestedValue;
    }
  }

  return undefined;
}

function buildMenuContextFromSource(source: unknown): MenuContextPayload | null {
  const context = {
    sub_institute_id: readNumber(getValueFromObject(source, ['sub_institute_id', 'subInstituteId', 'subInstituteID'])),
    user_id: readNumber(getValueFromObject(source, ['user_id', 'userId', 'userID', 'id'])),
    user_profile_name: readString(getValueFromObject(source, ['user_profile_name', 'userProfileName', 'user_profile', 'userProfile', 'profile_name', 'profileName'])),
    user_profile_id: readNumber(getValueFromObject(source, ['user_profile_id', 'userProfileId', 'userProfileID', 'profile_id', 'profileId'])),
    client_id: readNumber(getValueFromObject(source, ['client_id', 'clientId', 'clientID'])),
  };

  if (!context.sub_institute_id || !context.user_id) return null;

  return {
    ...context,
    user_profile_name: context.user_profile_name || 'ADMIN',
  };
}

function isValidMenuContext(context: MenuContextPayload | null | undefined): context is MenuContextPayload {
  return Boolean(context?.sub_institute_id && context.user_id);
}

function getStoredMenuContext(): MenuContextPayload | null {
  if (typeof window === 'undefined') return null;

  const storageKeys = ['menuContext', 'sessionData', 'sessiondata', 'userData', 'user_data', 'session'];
  for (const key of storageKeys) {
    const stored = localStorage.getItem(key);
    if (!stored) continue;

    try {
      const parsed = JSON.parse(stored);
      const context = buildMenuContextFromSource(parsed);
      if (context) {
        return context;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeLevel(value: unknown): ApiMenuItem[] {
   if (Array.isArray(value)) return value;
   if (!value || typeof value !== 'object') return [];
   return Object.values(value).filter((item): item is ApiMenuItem => {
     return Boolean(item && typeof item === 'object' && 'id' in item && 'name' in item);
   });
 }

export function useMenuRights() {
   const { menuContext } = useAuth();
   const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const fetchMenu = useCallback(async () => {
     const requestContext = isValidMenuContext(menuContext) ? menuContext : getStoredMenuContext();

     if (!requestContext) {
       setMenuItems([]);
       setError('Menu session data is missing.');
       return;
     }

     setLoading(true);
     setError(null);
     try {
       const res = await fetch(`${API_BASE_URL}/api/menu-rights`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           type: 'API',
           sub_institute_id: requestContext.sub_institute_id,
           user_id: requestContext.user_id,
           user_profile_name: requestContext.user_profile_name,
           user_profile_id: requestContext.user_profile_id,
           client_id: requestContext.client_id,
         }),
       });
       const data = (await res.json()) as MenuRightsResponse;
       if (!res.ok) throw new Error(data.message || 'Failed to fetch menu rights');
       if (data.status && data.status !== 1) throw new Error('Menu rights request failed');

       const rawL1 = data.data?.['level 1'] ?? data['level 1'];
       const rawL2 = data.data?.['level 2'] ?? data['level 2'];
       const rawL3 = data.data?.['level 3'] ?? data['level 3'];

       const l1 = normalizeLevel(rawL1);
       const l2 = rawL2 || {};
       const l3 = rawL3 || {};

       const tree = buildMenuTree(l1, l2, l3);
       setMenuItems(tree);
     } catch (e: unknown) {
       setError(e instanceof Error ? e.message : 'Unknown error');
       setMenuItems([]);
     } finally {
       setLoading(false);
     }
   }, [menuContext]);

   useEffect(() => {
     // The menu must be loaded after browser storage/auth context is available.
     // eslint-disable-next-line react-hooks/set-state-in-effect
     fetchMenu();
   }, [fetchMenu]);

   return { menuItems, loading, error, refetch: fetchMenu };
 }
