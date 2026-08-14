import type { FormEvent } from 'react';

export const MOBILE_NUMBER_PATTERN = /^[6-9]\d{9}$/;

/** Strips non-digit characters as the user types/pastes, capped at 10 digits. */
export function sanitizeMobileNumberInput(event: FormEvent<HTMLInputElement>): void {
  const input = event.currentTarget;
  const digitsOnly = input.value.replace(/\D/g, '').slice(0, 10);
  if (digitsOnly !== input.value) {
    input.value = digitsOnly;
  }
}

/** Returns a validation message for a non-empty, invalid mobile number, or '' when valid/blank. */
export function getMobileNumberError(value: string): string {
  if (!value) return '';
  return MOBILE_NUMBER_PATTERN.test(value) ? '' : 'Enter a valid 10-digit mobile number starting with 6-9.';
}
