
export const getEnv = (key: string): string => {
    // Strict Mode: Only use Vite's standard import.meta.env
    // This prevents accidental leaks via window or process in client-side code.
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // Priority 1: Exact Key
            if (import.meta.env[key]) return import.meta.env[key];

            // Priority 2: VITE_ Prefix (Standard for exposed vars)
            if (!key.startsWith('VITE_') && import.meta.env[`VITE_${key}`]) {
                return import.meta.env[`VITE_${key}`];
            }
        }
    } catch (e) {
        // Environment access error
        console.warn(`Error accessing environment variable ${key}`, e);
    }

    return "";
};

export const IS_DEV = import.meta.env.DEV;
