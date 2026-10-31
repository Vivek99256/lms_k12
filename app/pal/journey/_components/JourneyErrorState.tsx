import React from 'react';
import { ErrorState } from '@/components/ui/error-state';

export function JourneyErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <ErrorState title="Couldn’t load this journey" description={message} retry={onRetry} />;
}
