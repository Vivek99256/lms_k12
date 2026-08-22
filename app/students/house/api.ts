'use client';

import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';

export type HouseMember = { id: string; initials: string; name?: string };

export type HouseData = {
  id: string;
  name: string;
  points: number;
  captain: { name: string; initials: string };
  memberCount: number;
  members: HouseMember[];
  color: string;
  borderColor: string;
};

type ApiEnvelope = { status?: string | number; message?: string; data?: unknown };

function assertSuccess(payload: ApiEnvelope) {
  if (Number(payload.status) !== 1) throw new Error(payload.message || 'Unable to load houses.');
}

function sessionParams() {
  const session = getFeesSession();
  const params = new URLSearchParams();
  appendSessionParams(params, session);
  return { session, params };
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const PALETTE = [
  { color: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgb(239, 68, 68)' }, // red
  { color: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgb(59, 130, 246)' }, // blue
  { color: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgb(16, 185, 129)' }, // emerald
  { color: 'rgba(245, 158, 11, 0.2)', borderColor: 'rgb(245, 158, 11)' }, // amber
];

export async function getHouses(signal?: AbortSignal): Promise<HouseData[]> {
  const { session, params } = sessionParams();

  const [metadataPayload, rosterPayload] = await Promise.all([
    fetchLaravelJson<ApiEnvelope>(session, `/api/proxy?path=student-registration/metadata&${params.toString()}`, { signal }),
    fetchLaravelJson<ApiEnvelope>(session, `/api/proxy?path=get_adminStudentSearch&${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal,
    }),
  ]);

  assertSuccess(metadataPayload);
  assertSuccess(rosterPayload);

  const houses = toArray(asRecord(metadataPayload.data).houses).map(asRecord);
  const roster = toArray(rosterPayload.data).map(asRecord);

  const membersByHouseId = new Map<string, HouseMember[]>();
  roster.forEach((row) => {
    const houseId = readString(row.house_id);
    if (!houseId) return;
    const name = [row.first_name, row.middle_name, row.last_name].map(readString).filter(Boolean).join(' ');
    const members = membersByHouseId.get(houseId) ?? [];
    members.push({ id: readString(row.student_id ?? row.id), initials: initialsOf(name) || '—', name });
    membersByHouseId.set(houseId, members);
  });

  return houses.map((house, index) => {
    const houseId = readString(house.id);
    const members = membersByHouseId.get(houseId) ?? [];
    const palette = PALETTE[index % PALETTE.length];
    const captain = members[0];
    return {
      id: houseId,
      name: readString(house.name),
      points: members.length,
      captain: captain ? { name: captain.name ?? '', initials: captain.initials } : { name: '—', initials: '—' },
      memberCount: members.length,
      members,
      color: palette.color,
      borderColor: palette.borderColor,
    };
  });
}
