import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
