import { ArrowUpRight, Bot, Image as ImageIcon, Presentation, Sparkles, type LucideIcon } from 'lucide-react';

type Platform = {
  name: string;
  description: string;
  category: string;
  website: string;
  logo: string;
  accent: string;
  surface: string;
  Icon: LucideIcon;
};

const platforms = [
  {
    name: 'Gamma',
    description: 'Create presentations, documents, and web pages with AI-powered design assistance.',
    category: 'Presentation generation',
    website: 'https://gamma.app',
    logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop stop-color='%2314265A'/%3E%3Cstop offset='1' stop-color='%235D96E8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='12' fill='url(%23g)'/%3E%3Cellipse cx='33' cy='52' rx='14' ry='4' fill='%230B2B5C'/%3E%3Ctext x='14' y='45' fill='white' font-family='Arial,sans-serif' font-size='42' font-weight='700' transform='rotate(-8 32 32)'%3EG%3C/text%3E%3C/svg%3E",
    accent: '#2553B5',
    surface: '#E8F0FF',
    Icon: Presentation,
  },
  {
    name: 'DeepSeek',
    description: 'Explore advanced reasoning, coding, and conversational AI for everyday work.',
    category: 'AI assistants',
    website: 'https://www.deepseek.com',
    logo: 'https://cdn.simpleicons.org/deepseek/2563EB',
    accent: '#2563EB',
    surface: '#EAF2FF',
    Icon: Bot,
  },
  {
    name: 'Midjourney',
    description: 'Generate rich visual concepts and artwork from natural-language prompts.',
    category: 'Image generation',
    website: 'https://www.midjourney.com',
    logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%23333' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 46c10-8 23-8 32-3L17 10c9 14 10 27-5 36Z'/%3E%3Cpath d='M43 43c-4-12-11-22-17-27 15 6 24 16 29 27Z'/%3E%3Cpath d='M7 49h51L38 59c-5 3-9 3-13 0-4 3-8 3-12 0l-6-6'/%3E%3C/g%3E%3C/svg%3E",
    accent: '#111827',
    surface: '#EEF2F7',
    Icon: ImageIcon,
  },
  {
    name: 'Claude',
    description: 'Use a thoughtful AI assistant for writing, analysis, learning, and coding tasks.',
    category: 'AI assistants',
    website: 'https://claude.ai',
    logo: 'https://cdn.simpleicons.org/anthropic/D97757',
    accent: '#D97757',
    surface: '#FFF0EB',
    Icon: Sparkles,
  },
  {
    name: 'Gemini',
    description: 'Work with Google’s multimodal AI for research, ideas, productivity, and more.',
    category: 'AI assistants',
    website: 'https://gemini.google.com',
    logo: 'https://cdn.simpleicons.org/googlegemini/4285F4',
    accent: '#4285F4',
    surface: '#EAF3FF',
    Icon: Sparkles,
  },
  {
    name: 'Runway',
    description: 'Create and edit videos with generative AI tools.',
    category: 'Video generation',
    website: 'https://runwayml.com',
    logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='r' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%2329D999'/%3E%3Cstop offset='1' stop-color='%2314B866'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23r)' fill-rule='evenodd' d='M12 10h25c10 0 17 7 17 16 0 7-4 12-10 15l9 9-9 8-13-14h-6v12H12V10Zm13 11v13h11c4 0 6-3 6-7s-2-6-6-6H25Z'/%3E%3Cpath fill='url(%23r)' d='M12 21c0-6 5-11 11-11h3v46h-3c-6 0-11-5-11-11V21Z'/%3E%3C/svg%3E",
    accent: '#14B866',
    surface: '#E7FBF2',
    Icon: ImageIcon,
  },
] satisfies readonly Platform[];

const platformGroups = ['Video generation', 'Presentation generation', 'Image generation', 'AI assistants'].map(
  (category) => ({
    category,
    platforms: platforms.filter((platform) => platform.category === category),
  })
);

export default function AiPlatformsPage() {
  return (
    <main className="min-h-full px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto">
        <section className="overflow-hidden rounded-[28px] bg-[#172554] px-6 py-10 text-white shadow-[0_16px_40px_rgba(23,37,84,0.2)] sm:px-10 sm:py-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#DDE8FF]">
              <Sparkles className="h-3.5 w-3.5" />
              AI toolkit
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Explore AI platforms</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-[#C8D7F1] sm:text-[17px]">
              A quick guide to popular AI platforms for creating, researching, writing, coding, and visual storytelling.
            </p>
          </div>
        </section>

        <section className="mt-8 space-y-8" aria-label="AI platforms">
          {platformGroups.map(({ category, platforms: categoryPlatforms }) => (
            <div key={category}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="shrink-0 text-[18px] font-semibold text-[#26364F]">{category}</h2>
                <span className="h-px flex-1 bg-[#D8E2EE]" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categoryPlatforms.map(({ name, website, logo, accent, surface, Icon }) => (
                  <article
                    key={name}
                    className="group rounded-[18px] border border-[#DCE5F1] bg-white p-4 shadow-[0_3px_10px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.1)]"
                  >
                    <a href={website} target="_blank" rel="noreferrer" className="flex items-center gap-3" aria-label={`Visit ${name}`}>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: surface }}>
                        {logo ? (
                          <img src={logo} alt={`${name} logo`} className="h-6 w-6" />
                        ) : (
                          <Icon className="h-6 w-6" style={{ color: accent }} aria-label={`${name} icon`} />
                        )}
                      </div>
                      <h3 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.02em] text-[#16233A]">{name}</h3>
                      <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} />
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#94A3B8] transition group-hover:text-[#475569]" />
                    </a>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
