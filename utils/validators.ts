import { z } from 'zod';

// --- Helper Schemas ---

const PersonalBestSchema = z.object({
    time: z.string(),
    date: z.string()
});

const InjurySchema = z.object({
    type: z.string(),
    location: z.string(),
    severity: z.enum(['Leve', 'Moderada', 'Grave']),
    status: z.enum(['Activa', 'Recuperación', 'Resuelta']),
    grade: z.number().optional(),
    description: z.string().optional(),
    diagnosedDate: z.string().optional(),
    recoveryStatus: z.number().optional()
});

const CoachSchema = z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(['Head Coach', 'Assistant', 'Physio', 'Biomechanist', 'Strength Coach', 'Nutritionist', 'Sport Psychologist']),
    email: z.string().optional(),
    phone: z.string().optional(),
    notes: z.string().optional()
});

const CompetitionSchema = z.object({
    id: z.string(),
    name: z.string(),
    date: z.string(),
    priority: z.enum(['A', 'B', 'C']).optional()
});

// --- Core Schemas ---

export const UserProfileSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    email: z.string().email("Email inválido").optional().or(z.literal('')),
    photoURL: z.string().optional(),
    role: z.enum(['athlete', 'staff']).default('athlete'),
    roster: z.array(z.string()).optional(),

    age: z.number().min(10).max(120),
    height: z.number().positive(),
    weight: z.number().positive(),
    restingHR: z.number().optional(),
    hrv: z.number().optional(),

    events: z.array(z.string()),
    pbs: z.object({
        '100m': PersonalBestSchema,
        '200m': PersonalBestSchema,
        '400m': PersonalBestSchema
    }),

    experienceLevel: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Elite']),
    yearsExperience: z.number(),
    injuries: z.array(InjurySchema).default([]),
    medicalConditions: z.string().optional(),
    coaches: z.array(CoachSchema).default([]),
    trainingDays: z.array(z.string()),
    hoursPerDay: z.number(),
    preferredTime: z.enum(['Morning', 'Afternoon', 'Evening']),
    competitions: z.array(CompetitionSchema).default([]),

    trainingPreferences: z.object({
        intensityBias: z.number().min(0.5).max(1.5).optional(),
        volumeBias: z.number().min(0.5).max(1.5).optional(),
        techniqueFocus: z.enum(['Balanced', 'Technique', 'Power']).optional()
    }).optional(),

    lastEditedBy: z.string().optional(),
    lastEditedAt: z.string().optional()
});

export const SessionFeedbackSchema = z.object({
    completed: z.boolean(),
    rpe: z.number().min(0).max(10),
    painLevel: z.number().min(0).max(10),
    surface: z.enum(['Track', 'Grass', 'Road', 'Gym', 'Other']),
    duration: z.number(),
    notes: z.string().optional(),
    timestamp: z.string().optional()
});

export const TrainingSessionSchema = z.object({
    day: z.string(),
    focus: z.string(),
    trackRoutine: z.array(z.string()).optional(),
    gymRoutine: z.array(z.string()).optional(),
    warmup: z.array(z.string()).optional(),
    drills: z.array(z.string()).optional(),
    mainSet: z.array(z.string()).optional(),
    cooldown: z.array(z.string()).optional(),
    biomechanicsKpi: z.string(),
    videoKeywords: z.array(z.string()),
    intensity: z.enum(['Low', 'Medium', 'High', 'Max']),
    footwear: z.enum(['Spikes', 'Flats', 'Other']).optional(),
    wind: z.enum(['Tail', 'Head', 'Neutral']).optional(),
    feedback: SessionFeedbackSchema.optional(),
    coachNotes: z.string().optional()
});

export const TrainingPlanSchema = z.object({
    id: z.string(),
    createdAt: z.string(),
    phase: z.enum(['General Prep', 'Specific Prep', 'Pre-Comp', 'Competition', 'Transition']),
    sessions: z.array(TrainingSessionSchema),
    weeklyGoal: z.string(),
    rationale: z.string(),
    focusEvent: z.string().optional(),
    archivedAt: z.string().optional(),
    acwrStatus: z.object({
        ratio: z.number(),
        status: z.enum(['Optimal', 'High Risk', 'Low Load'])
    }).optional()
});

export const PerformanceLogSchema = z.object({
    id: z.string(),
    date: z.string(),
    event: z.enum(['100m', '200m', '400m', 'Therapy']),
    type: z.enum(['Training', 'Competition', 'Recovery']),
    location: z.string(),
    time: z.number(),
    rpe: z.number().optional(),
    duration: z.number().optional(),
    notes: z.string()
});

export type ValidUserProfile = z.infer<typeof UserProfileSchema>;
export type ValidTrainingPlan = z.infer<typeof TrainingPlanSchema>;
export type ValidPerformanceLog = z.infer<typeof PerformanceLogSchema>;
