import Link from "next/link";
import { 
  Sparkles, 
  Calendar, 
  ArrowRight, 
  BookOpen, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  Zap 
} from "lucide-react";
import { AVAILABLE_VERSIONS } from "@/lib/docs/docs-types";

export const metadata = {
  title: "Documentation Releases | Scholar Portal",
  description: "Browse and navigate all versioned product documentation for the Scholar Suite.",
};

export default function ReleasesPage() {
  const latestVersion = AVAILABLE_VERSIONS.find((v) => v.isLatest) || AVAILABLE_VERSIONS[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Top Banner Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/docs/releases" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200 dark:shadow-none group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
              Scholar <span className="text-indigo-600 dark:text-indigo-400 font-normal">Documentation</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={`/docs/${latestVersion.version}`}
              className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-1.5"
            >
              <span>Explore Docs ({latestVersion.version})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-4 border border-indigo-200 dark:border-indigo-800">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Version Documentation Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Scholar Platform Releases
          </h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Browse comprehensive architecture, modules, API references, database schemas, and developer guides mapped directly to release specifications.
          </p>
        </div>

        {/* Feature Highlights Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">196+ Core Documents</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Complete ERP, LMS, CCB, Insight, and Compass specs read directly from local files.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Version 1.0.0 (v1)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All documentation mapped 1:1 to the <code>/docs/v1/</code> directory.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Instant Full-Text Search</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Modal search with keyboard shortcuts (Ctrl+K), category tagging and excerpt preview.</p>
            </div>
          </div>
        </div>

        {/* Versions Listing Cards */}
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Available Releases ({AVAILABLE_VERSIONS.length})
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE_VERSIONS.map((v) => (
              <div
                key={v.version}
                className="p-6 rounded-2xl border transition-all flex flex-col justify-between bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-600/70 shadow-lg shadow-indigo-100 dark:shadow-none ring-1 ring-indigo-500/20"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        Version {v.version}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Current Stable (v1)
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {v.releaseDate}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {v.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Scholar Core ERP
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Scholar Learn LMS
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      CCB & HRIT
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Enterprise Brain
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <Link
                    href={`/docs/${v.version}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    <span>Open Documentation (v{v.version})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href={`/docs/${v.version}/core`}
                    className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
                  >
                    Core Specs →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
