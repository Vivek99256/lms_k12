import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project.
  //
  // Turbopack otherwise infers a root by walking up for a lockfile, so a stray
  // package.json in a parent directory would silently widen it and start watching
  // trees that have nothing to do with this app. Stating the root keeps that boundary
  // fixed whatever ends up above the repo.
  //
  // Nothing is reached across for: the `@shared/*` imports resolve to `packages/` in
  // this repo via the tsconfig paths, and the `g2g` UI components are local too
  // (`components/ui/g2g`). Both were once described here as living in a sibling
  // checkout; neither does.
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: '/admission-enquiry',
        destination: '/admission-Enquiry',
      },
      {
        source: '/admission-registration',
        destination: '/admissions/registration',
      },
      {
        source: '/admission-confirmation',
        destination: '/admissions/confirmation',
      },
      {
        source: '/course-master/lesson-plan/:courseId/assessment',
        destination: '/course-master/lesson-plan/:courseId?view=assessment',
      },
    ];
  },
};

export default nextConfig;
