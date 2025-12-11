// Add Weight if missing
export interface UserProfile {
  // ... existing fields ...
  weight: number; 
  // ... existing fields ...
}

// Add Feedback timestamp if missing
export interface SessionFeedback {
  // ... existing fields ...
  timestamp?: string;
}