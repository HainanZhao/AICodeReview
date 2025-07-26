// Browser-safe exports - excludes Node.js specific modules
export * from './types/gitlab.js';
export * from './services/gitlabCore.js';
export * from './services/aiReviewCore.js';

// Note: geminiCliCore and aiProviderCore are excluded as they contain Node.js dependencies
// Note: types.ts is excluded to avoid conflicts with types/gitlab.ts
