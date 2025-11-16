/**
 * Server-side initialization
 * This file is imported by API routes to ensure initialization happens
 */

import { initializeApp } from './init';

// Initialize on module load (server-side only)
if (typeof window === 'undefined') {
  initializeApp().catch((error) => {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });
}

export { };
