import { execSync } from "node:child_process";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * A value that changes on every deploy, used both as Next's build id and as the
 * `NEXT_PUBLIC_APP_BUILD_ID` the client compares itself against (see
 * `lib/app-version.ts`). Deriving it from the commit rather than declaring a version
 * constant means nobody has to remember to bump anything for a returning browser to
 * notice that the app moved on.
 *
 * Order of preference: the CI-provided commit SHA, then the local git HEAD, then a
 * build timestamp for a checkout with no git available. The timestamp fallback is
 * still correct — it is unique per build — it is just not traceable back to a commit.
 */
function resolveBuildId(): string {
  const ciSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.CI_COMMIT_SHA;
  if (ciSha) return ciSha.slice(0, 12);

  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
      .slice(0, 12);
  } catch {
    return `build-${Date.now()}`;
  }
}

const BUILD_ID = resolveBuildId();

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
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: BUILD_ID,
  },
  // Keep the asset path in step with the build id, so a new deploy's chunks can never
  // collide with a cached chunk of the same name from the previous one.
  generateBuildId: async () => BUILD_ID,
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
