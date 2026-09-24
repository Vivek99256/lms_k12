'use client';

import { ModuleIntelligence } from '@/components/intelligence/module/ModuleIntelligence';
import { libraryIntelligenceContract } from '@/components/intelligence/module/contracts/library';

/**
 * Library -> Intelligence.
 *
 * Three lines of substance, because everything that makes this screen is either
 * in the contract or in the shared renderer. The route file still has to exist:
 * Next resolves `/library/intelligence` inside the existing `app/library/`
 * segment, so no top-level dynamic route can stand in for it.
 *
 * The registry is what decides a module HAS this screen
 * (`resolveIntelligenceModuleForMenu`), and `intelligenceHrefFor` is what puts
 * the menu item here — so this path is not free-chosen and must keep matching
 * the registry entry. lib/brain/intelligence-navigation.test.ts pins the pair.
 */
export default function Page() {
  return <ModuleIntelligence contract={libraryIntelligenceContract} />;
}
