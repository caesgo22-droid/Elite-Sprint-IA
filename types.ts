
// types.ts

export interface PersonalBest { time: string; date: string; }
export interface Injury { type: string; location: string; severity: 'Leve' | 'Moderada' | 'Grave'; status: 'Activa' | 'Recuperación' | 'Resuelta'; }

export interface Coach {
  id: string;
  name: string;
  role: 'Head Coach' | 'Assistant' | 'Physio' | 'Biomechanist' | 'Strength Coach' | 'Nutritionist' | 'Sport Psychologist';
  email?: string;
  phone?: string;
  notes?: string;
}

export interface UserProfile {
  name: string;
  email?: string; // Critical for Staff lookup
  role: 'athlete' | 'staff'; // NEW: Role definition
  roster?: string[]; // NEW: For staff, list of athlete UIDs they manage
  
  age: number;
  height: number;
  weight: number; 
  restingHR?: number;
  hrv?: number;
  events: string[];
  pbs: { '100m': PersonalBest; '200m': PersonalBest; '400m': PersonalBest; };
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
  yearsExperience: number;
  injuries: Injury[];
  medicalConditions?: string;
  coaches: Coach[];
  trainingDays: string[];
  hoursPerDay: number;
  preferredTime: 'Morning' | 'Afternoon' | 'Evening';
  competitions: { id: string; name: string; date: string }[];
}

export interface SessionFeedback {
  completed: boolean;
  rpe: number;
  painLevel: number;
  surface: 'Track' | 'Grass' | 'Road' | 'Gym' | 'Other';
  duration: number;
  notes?: string;
  timestamp?: string;
}

export interface TrainingSession {
  day: string;
  focus: string;
  trackRoutine: string[];
  gymRoutine?: string[];
  biomechanicsKpi: string;
  videoKeywords: string[];
  intensity: 'Low' | 'Medium' | 'High' | 'Max';
  feedback?: SessionFeedback;
  coachNotes?: string; // NEW: Direct instruction from Staff/AI to Athlete specific for this day
}

export interface TrainingPlan {
  id: string;
  createdAt: string;
  phase: 'General Prep' | 'Specific Prep' | 'Pre-Comp' | 'Competition' | 'Transition';
  sessions: TrainingSession[];
  weeklyGoal: string;
  rationale: string;
  focusEvent?: string;
  archivedAt?: string;
  acwrStatus?: { ratio: number; status: 'Optimal' | 'High Risk' | 'Low Load'; };
}

export interface KineticMetrics {
  verticalOscillation: string; // "4.2 cm"
  forceApplicationIndex: number; // 0-100 scale of efficiency
  comVelocity: string; // Center of Mass Velocity
}

export interface BiomechanicalAnalysis {
  id: string;
  type: 'Single' | 'Sequence';
  category: 'Personal' | 'External'; 
  phaseDetected: string;
  jointAngles: { knee?: string; hip?: string; torso?: string; shin?: string; };
  kinetics?: KineticMetrics; // NEW: Advanced Physics Data
  groundContactTimeEstimate: string;
  criticalErrors: string[];
  correctiveDrills: string[];
  coachShouts: string[];
  score: number;
  thumbnail?: string;
  savedAt?: string;
}

export interface PerformanceLog {
  id: string;
  date: string;
  event: '100m' | '200m' | '400m' | 'Therapy'; // Added Therapy
  type: 'Training' | 'Competition' | 'Recovery'; // Added Recovery
  location: string;
  time: number; // 0 for therapy
  notes: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: number;
  isToolLog?: boolean;
}

export interface NexusInsight {
  status: 'Peak' | 'Recovery' | 'Warning' | 'Neutral';
  headline: string;
  analysis: string;
  recommendation: string;
  timestamp?: number; // To check validity
}

export interface Drill { name: string; category: 'Accel' | 'MaxV' | 'Plyo' | 'Strength' | 'Recovery'; intensity: number; videoKeyword: string; }
export interface PhaseTemplate { name: string; focusPoints: string[]; weeklyStructure: { [day: string]: string }; }
export interface Vector2D { x: number; y: number; }
