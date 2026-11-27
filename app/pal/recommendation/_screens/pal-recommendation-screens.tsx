'use client';

import { Lightbulb } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { PalRecommendationScreen } from '@/app/pal/recommendation/_components/PalRecommendationScreen';

export const PAL_RECOMMENDATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'pal-recommendation',
    label: 'Recommendation',
    icon: Lightbulb,
    render: () => <PalRecommendationScreen />,
  },
];
