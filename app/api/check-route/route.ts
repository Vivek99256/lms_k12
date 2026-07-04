import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const APP_DIR = path.join(process.cwd(), 'app');

/**
 * Generate variations of a route path with underscores/hyphens swapped
 */
function getPathVariations(routePath: string): string[] {
  const variations: string[] = [routePath];
  
  let cleanPath = routePath.startsWith('/') ? routePath.slice(1) : routePath;
  
  // Replace underscores with hyphens
  const withHyphens = cleanPath.replace(/_/g, '-');
  if (withHyphens !== cleanPath) {
    variations.push('/' + withHyphens);
  }
  
  // Replace hyphens with underscores
  const withUnderscores = cleanPath.replace(/-/g, '_');
  if (withUnderscores !== cleanPath) {
    variations.push('/' + withUnderscores);
  }
  
  return [...new Set(variations)];
}

/**
 * Check if a route path exists in the app directory
 */
function routeExistsInApp(routePath: string): boolean {
  const cleanPath = routePath.startsWith('/') ? routePath.slice(1) : routePath;
  const pagePath = path.join(APP_DIR, cleanPath, 'page.tsx');
  return fs.existsSync(pagePath);
}

/**
 * Find the first existing route from variations
 */
function findExistingRoute(routePath: string): string {
  const variations = getPathVariations(routePath);
  
  for (const variation of variations) {
    if (routeExistsInApp(variation)) {
      return variation;
    }
  }
  
  // Return original path - let Next.js handle 404
  return routePath;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const link = searchParams.get('link');

  if (!link) {
    return NextResponse.json({ route: '#', error: 'No link provided' }, { status: 400 });
  }

  // Clean the link
  let cleanLink = link.trim();
  const lowerLink = cleanLink.toLowerCase();

  if (lowerLink === 'javascript:void(0);' || lowerLink === 'javascript:void(0)' || lowerLink === '#' || lowerLink === '') {
    return NextResponse.json({ route: '#', reason: 'void link' });
  }

  // Remove trailing slashes
  cleanLink = cleanLink.replace(/\/+$/, '');

  if (!cleanLink) {
    return NextResponse.json({ route: '#', reason: 'empty after cleaning' });
  }

  // Ensure leading slash
  const routePath = cleanLink.startsWith('/') ? cleanLink : '/' + cleanLink;

  // Find existing route (checking _ and - variations)
  const existingRoute = findExistingRoute(routePath);

  return NextResponse.json({
    original: routePath,
    route: existingRoute,
    found: existingRoute !== routePath ? false : routeExistsInApp(existingRoute),
  });
}
