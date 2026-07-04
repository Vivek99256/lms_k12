'use client';

import { useRouter } from 'next/navigation';
import { FileX2, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center px-4 py-12">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50">
          <FileX2 className="h-12 w-12 text-red-500" />
        </div>

        {/* Content */}
        <h1 className="mb-3 text-4xl font-bold text-gray-900">404</h1>
        <h2 className="mb-4 text-xl font-semibold text-gray-700">Page Not Found</h2>
        <p className="mb-8 text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Please check the URL or navigate back to the dashboard.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="h-11 rounded-xl border-gray-200 px-6 text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button
            onClick={() => router.push('/dashboard')}
            className="h-11 rounded-xl bg-gradient-to-r from-[#0D6EFD] to-blue-600 px-8 font-semibold text-white shadow-md shadow-blue-500/20 hover:from-[#0D6EFD]/90 hover:to-blue-600/90"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
