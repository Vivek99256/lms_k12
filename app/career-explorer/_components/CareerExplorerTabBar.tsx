'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TabOption {
  label: string;
  href: string;
  src: string;
  activeSrc: string;
}

const TAB_OPTIONS: TabOption[] = [
  {
    label: 'Find Occupation',
    href: '/career-explorer',
    src: '/images/career-explorer/Frame 375 (7).png',
    activeSrc: '/images/career-explorer/Frame 375.png',
  },
  {
    label: 'College Profile',
    href: '/career-explorer/college',
    src: '/images/career-explorer/Frame 375 (6).png',
    activeSrc: '/images/career-explorer/Frame 375 (3).png',
  },
  {
    label: 'Course Profile',
    href: '/career-explorer/courses',
    src: '/images/career-explorer/Frame 375 (1).png',
    activeSrc: '/images/career-explorer/Frame 375 (4).png',
  },
  {
    label: 'Employer Profile',
    href: '/career-explorer/employers',
    src: '/images/career-explorer/Frame 375 (2).png',
    activeSrc: '/images/career-explorer/Frame 375 (5).png',
  },
];

export function CareerExplorerTabBar() {
  const pathname = usePathname();

  return (
    <div className="bg-card pt-[34px] rounded-[10px] md:rounded-[48px] my-5 md:my-10">
      <div className="flex justify-center md:space-x-6 pb-[34px]">
        {TAB_OPTIONS.map((option) => {
          const isActive = pathname === option.href;
          return (
            <Link key={option.href} href={option.href} className="cursor-pointer text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no next/image usage in this project */}
              <img
                src={isActive ? option.activeSrc : option.src}
                alt={option.label}
                width={100}
                height={100}
                className="mx-auto"
              />
              <p className={`mt-1 text-sm ${isActive ? 'text-[#0D6EFD] font-semibold' : 'text-card-foreground'}`}>
                {option.label}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
