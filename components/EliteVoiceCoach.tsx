
import * as React from 'react';
import { GeminiLive } from './GeminiLive';

// DEPRECATED: This component is a shim to prevent build errors from stale references.
// Logic has been moved to GeminiLive.tsx for the Native Audio upgrade.
export const EliteVoiceCoach: React.FC = () => {
  return <GeminiLive />;
};
