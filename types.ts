

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
  photoURL?: string; // Profile photo
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
  trackRoutine?: string[];
  gymRoutine?: string[];
  warmup?: string[];
  drills?: string[];
  mainSet?: string[];
  cooldown?: string[];
  biomechanicsKpi: string;
  videoKeywords: string[];
  intensity: 'Low' | 'Medium' | 'High' | 'Max';
  footwear?: 'Spikes' | 'Flats' | 'Other'; // NEW: Context for stiffness
  wind?: 'Tail' | 'Head' | 'Neutral'; // NEW: Context for velocity
  feedback?: SessionFeedback;
  coachNotes?: string;
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
  groundContactTime?: string; // NEW: "0.108s"
  airTime?: string; // NEW: "0.142s"
  strideFreq?: string; // NEW: "4.5 Hz"
}

export interface BiomechanicalAnalysis {
  id: string;
  type: 'Single' | 'Sequence' | 'Filmstrip' | 'MasterAudit';
  category: 'Personal' | 'External';
  phaseDetected: string;
  jointAngles: { knee?: string; hip?: string; torso?: string; shin?: string; };
  kinetics?: KineticMetrics; // NEW: Advanced Physics Data
  groundContactTimeEstimate: string; // Legacy AI estimate, kept for fallback
  criticalErrors: string[];
  correctiveDrills: string[];
  coachShouts: string[];
  score: number;
  thumbnail?: string;
  savedAt?: string;
  timestamp?: number; // Exact video timestamp for verification
  coachNotes?: string; // NEW: Staff feedback on video
  reviewStatus?: 'Pending' | 'Reviewed'; // NEW: For remote coaching queue
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

export interface LoadStats {
  acuteLoad: number;   // 7-day average
  chronicLoad: number; // 28-day average
  ratio: number;       // ACWR
  status: 'Óptimo' | 'Alto Riesgo' | 'Carga Baja';
}

export interface Drill { name: string; category: 'Accel' | 'MaxV' | 'Plyo' | 'Strength' | 'Recovery'; intensity: number; videoKeyword: string; }
export interface PhaseTemplate { name: string; focusPoints: string[]; weeklyStructure: { [day: string]: string }; }
export interface Vector2D { x: number; y: number; }

export interface StaffReply {
  id: string;
  authorName: string;
  role: string;
  content: string;
  timestamp: string;
}

export interface StaffBriefing {
  id: string;
  athleteId: string;
  authorId: string;
  authorName: string;
  role: string;
  content: string;
  attachments?: string[];
  timestamp: string;
  type: 'Strategy' | 'Physical' | 'Psychology' | 'Technique' | 'General';
  replies?: StaffReply[];
}