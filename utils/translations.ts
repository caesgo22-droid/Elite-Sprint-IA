
export type Language = 'es' | 'en';

export const TRANSLATIONS = {
  es: {
    nav: { home: 'Inicio', plan: 'Plan', analysis: 'Análisis', stats: 'Stats', staff: 'Staff', coach: 'Coach' },
    role: { athlete: 'Atleta', staff: 'Entrenador' },
    layout: {
        science: 'Fundamentación Técnica',
        viewing: 'VISTA PREVIA',
        exit: 'Salir',
        changeRole: 'Cambiar Rol a',
        editProfile: 'Editar Perfil',
        logout: 'Cerrar Sesión'
    },
    dashboard: {
        nexusTitle: 'Inteligencia de Alto Rendimiento',
        nexusLoading: 'Correlacionando Biomecánica, Fisiología y Tiempos...',
        sundayPrompt: '¡Es Domingo! Hora de planificar la semana.',
        planBtn: 'Planificar',
        quickAction: 'Bitácora Terapia',
        quickActionSub: 'Bajar ACWR',
        progress: 'Progreso',
        phase: 'Fase',
        today: 'Hoy',
        focus: 'Enfoque Principal',
        bioFocus: 'Foco Biomecánico',
        routine: 'Rutina de Pista',
        sessionDone: 'Sesión Completada',
        viewRecovery: 'Ver Plan de Recuperación',
        markDone: 'Marcar Completada',
        noSession: 'No hay sesión asignada para hoy.',
        genPlan: 'Generar Plan'
    },
    staff: {
        title: 'Panel de Staff',
        subtitle: 'Gestión de Roster & Alto Rendimiento',
        add: 'Agregar Atleta',
        searchPlaceholder: 'email.atleta@ejemplo.com',
        roster: 'Tu Roster',
        noAthletes: 'No tienes atletas asignados.',
        loading: 'Cargando atletas...',
        pulseTitle: 'Squad Pulse (Monitor)',
        highRisk: 'Riesgo Alto',
        optimal: 'Óptimo',
        lowLoad: 'Carga Baja',
        painAlert: 'Dolor Reportado'
    },
    ai: {
        promptLang: 'Responde estrictamente en ESPAÑOL.'
    }
  },
  en: {
    nav: { home: 'Home', plan: 'Plan', analysis: 'Analysis', stats: 'Stats', staff: 'Staff', coach: 'Coach' },
    role: { athlete: 'Athlete', staff: 'Coach' },
    layout: {
        science: 'Technical Whitepaper',
        viewing: 'PREVIEW MODE',
        exit: 'Exit',
        changeRole: 'Switch Role to',
        editProfile: 'Edit Profile',
        logout: 'Log Out'
    },
    dashboard: {
        nexusTitle: 'High Performance Intelligence',
        nexusLoading: 'Correlating Biomechanics, Physiology & Times...',
        sundayPrompt: 'It\'s Sunday! Time to plan the week.',
        planBtn: 'Plan Now',
        quickAction: 'Therapy Log',
        quickActionSub: 'Lower ACWR',
        progress: 'Progress',
        phase: 'Phase',
        today: 'Today',
        focus: 'Main Focus',
        bioFocus: 'Biomechanics KPI',
        routine: 'Track Routine',
        sessionDone: 'Session Completed',
        viewRecovery: 'View Recovery Plan',
        markDone: 'Mark Completed',
        noSession: 'No session assigned for today.',
        genPlan: 'Generate Plan'
    },
    staff: {
        title: 'Staff Dashboard',
        subtitle: 'Roster Management & High Performance',
        add: 'Add Athlete',
        searchPlaceholder: 'athlete.email@example.com',
        roster: 'Your Roster',
        noAthletes: 'No athletes assigned.',
        loading: 'Loading athletes...',
        pulseTitle: 'Squad Pulse (Monitor)',
        highRisk: 'High Risk',
        optimal: 'Optimal',
        lowLoad: 'Low Load',
        painAlert: 'Pain Reported'
    },
    ai: {
        promptLang: 'Respond strictly in ENGLISH.'
    }
  }
};
