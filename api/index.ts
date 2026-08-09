import 'reflect-metadata'

/**
 * Vercel serverless entry point. All routes are rewritten here via vercel.json.
 * The actual handler (with lazy database initialization) lives in src/app so
 * there is a single source of truth regardless of which module the platform
 * builds from.
 */
export { default } from '../src/app'
