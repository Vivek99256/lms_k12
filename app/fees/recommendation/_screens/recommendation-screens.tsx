'use client';

import { Lightbulb } from 'lucide-react';

import type { ModuleStaticScreen } from '@/app/_components/module-category-page';
import { FeesRecommendationScreen } from '@/app/fees/recommendation/_components/fees-recommendation-screen';

export const FEES_RECOMMENDATION_SCREENS: ModuleStaticScreen[] = [
  {
    id: 'fees-recommendation',
    label: 'Recommendation',
    icon: Lightbulb,
    render: () => <FeesRecommendationScreen />,
  },
];
