import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack to the shared parent directory so LMS can import the
  // centralized conversational AI packages hosted in the sibling G2G repo
  // without widening all the way to unrelated machine roots.
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
