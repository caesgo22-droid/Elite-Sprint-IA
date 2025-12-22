
export const getEnv = (key: string): string => {
    // 1. Try Vite standard (import.meta.env)
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // Try exact key
            if (import.meta.env[key]) return import.meta.env[key];
            // Try with VITE_ prefix if not provided
            if (!key.startsWith('VITE_') && import.meta.env[`VITE_${key}`]) {
                return import.meta.env[`VITE_${key}`];
            }
        }
    } catch (e) {
        // Ignore errors accessing import.meta
    }

    // 2. Try window (for runtime injection or browser overrides)
    try {
        if (typeof window !== 'undefined' && (window as any)._env_ && (window as any)._env_[key]) {
            return (window as any)._env_[key];
        }
    } catch (e) {
        // Ignore
    }

    // 3. Try process.env (safely)
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            if (process.env[key]) return process.env[key];
            // @ts-ignore
            if (!key.startsWith('VITE_') && process.env[`VITE_${key}`]) return process.env[`VITE_${key}`];
        }
    } catch (e) {
        // Ignore
    }

    return "";
};

export const IS_DEV = import.meta.env.DEV;
