// Frontend Configuration
// Loads from environment variables or defaults

interface Config {
  apiBase: string;
  humeApiKey: string;
  userId: string;
  isDevelopment: boolean;
}

function getEnvVar(key: string, defaultValue: string = ''): string {
  // For Vite-based build systems
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as any)[key] || defaultValue;
  }
  
  // For browser environments (check window)
  if (typeof window !== 'undefined' && (window as any).ENV) {
    return (window as any).ENV[key] || defaultValue;
  }
  
  return defaultValue;
}

export const config: Config = {
  apiBase: getEnvVar('VITE_API_BASE', 'https://svc-01ka9tm46dtzqcvz88z5v3c9kc.01ka41m1warcc7s5zveqw1tt3z.lmapp.run'),
  humeApiKey: getEnvVar('VITE_HUME_API_KEY', ''),
  userId: getEnvVar('VITE_USER_ID', 'demo_user'),
  isDevelopment: getEnvVar('NODE_ENV', 'production') === 'development'
};

// Validation
if (!config.humeApiKey && typeof window !== 'undefined') {
  console.warn('⚠️ VITE_HUME_API_KEY not set. Voice features will not work.');
}

export default config;
