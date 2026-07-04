/**
 * Dynamic Routes Registry
 * This file maintains a list of all valid routes in the app directory.
 * When a menu item's link from API doesn't match any known route,
 * Next.js will automatically show the 404 page.
 */

import fs from 'fs';
import path from 'path';

const APP_DIR = path.join(process.cwd(), 'app');

/**
 * Recursively find all page.tsx files in the app directory
 * and convert them to route paths
 */
function findRoutes(dir: string, basePath: string = ''): string[] {
  const routes: string[] = [];
  
  if (!fs.existsSync(dir)) return routes;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    // Skip hidden files/directories and non-route directories
    if (entry.name.startsWith('.') || 
        entry.name === 'node_modules' ||
        entry.name === 'components' ||
        entry.name === 'hooks' ||
        entry.name === 'data' ||
        entry.name === 'lib' ||
        entry.name === 'contexts') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip directories that don't contain page files
      const pagePath = path.join(fullPath, 'page.tsx');
      const pageLayoutPath = path.join(fullPath, 'layout.tsx');
      
      if (fs.existsSync(pagePath) || fs.existsSync(pageLayoutPath)) {
        // This is a valid route directory
        const routePath = basePath === '' ? `/${entry.name}` : `${basePath}/${entry.name}`;
        routes.push(routePath);
        
        // Also check for nested routes in this directory
        routes.push(...findRoutes(fullPath, routePath));
      } else {
        // Check nested directories
        routes.push(...findRoutes(fullPath, basePath === '' ? '' : basePath));
      }
    }
  }
  
  return routes;
}

/**
 * Get all valid dynamic routes from the app directory
 * These are routes that will show actual content (have page.tsx)
 */
export function getDynamicRoutes(): string[] {
  return findRoutes(APP_DIR);
}

/**
 * Check if a route exists in the app directory
 * @param route - The route to check (e.g., "/students/search_student")
 * @returns true if the route exists
 */
export function routeExists(route: string): boolean {
  // Normalize the route
  const normalizedRoute = route.startsWith('/') ? route.slice(1) : route;
  
  // Build the potential page path
  const pagePath = path.join(APP_DIR, normalizedRoute, 'page.tsx');
  const indexPagePath = path.join(APP_DIR, normalizedRoute, 'index.tsx');
  
  return fs.existsSync(pagePath) || fs.existsSync(indexPagePath);
}

/**
 * Get the route for a given API link
 * @param apiLink - The link from API (e.g., "students/search_student/" or "students/search_student")
 * @returns The Next.js route path or null if route doesn't exist
 */
export function getRouteFromApiLink(apiLink: string | null | undefined): string | null {
  if (!apiLink) return null;
  
  // Clean the link - remove leading/trailing slashes
  let cleanLink = apiLink.trim().replace(/\/+$/, '').replace(/^\/+/, '');
  
  if (!cleanLink) return null;
  
  // Check if route exists
  if (!routeExists('/' + cleanLink)) {
    return null;
  }
  
  return '/' + cleanLink;
}
