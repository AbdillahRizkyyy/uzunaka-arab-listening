export type AppEnvironment = 'development' | 'staging' | 'production';

/** Deployment purpose is separate from Next.js's optimized production runtime. */
export function appEnvironment(): AppEnvironment {
  const configured = process.env.APP_ENV;
  if (configured === 'development' || configured === 'staging' || configured === 'production')
    return configured;
  // A misspelled or unknown value must never expose development content.
  if (configured) return 'production';
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function isStaging() {
  return appEnvironment() === 'staging';
}

export function allowsDemoContent() {
  return appEnvironment() !== 'production';
}
