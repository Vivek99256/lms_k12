'use client';

import React from 'react';

/**
 * Renders an authentic miniature architectural wireframe of each template's
 * distinctive structural layout (not just color swatches).
 * Shows the exact visual hierarchy, header positioning, content block arrangement,
 * and presentation style that users will experience in preview and exports.
 */
export function TemplateLayoutWireframe({ templateId }: { templateId: string }) {
  switch (templateId) {
    case 'academic_classic':
      return (
        <div className="w-full h-[72px] rounded-md border-2 border-double border-blue-900/50 bg-[#faf7f0] p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs font-serif select-none">
          {/* Classical Running Head */}
          <div className="flex items-center justify-between border-b border-blue-900/20 pb-0.5">
            <span className="text-[7.5px] font-bold text-blue-950 tracking-wider">🏛️ CBSE MONOGRAPH</span>
            <span className="text-[7px] text-blue-900/70 font-mono font-bold">§ 1.0</span>
          </div>
          {/* Centered Academic Block with Double Rule */}
          <div className="text-center py-0.5">
            <div className="h-1.5 w-20 bg-blue-950/80 mx-auto rounded-xs mb-0.5" />
            <div className="flex items-center justify-center gap-1">
              <div className="h-[1px] w-5 bg-blue-900/40" />
              <span className="text-[6.5px] text-blue-900 leading-none">❖</span>
              <div className="h-[1px] w-5 bg-blue-900/40" />
            </div>
          </div>
          {/* Two-Column Formal Ledger */}
          <div className="grid grid-cols-2 gap-1.5 border-t border-blue-900/20 pt-1">
            <div className="flex items-center gap-1 border-r border-blue-900/15 pr-1">
              <span className="text-[6.5px] text-blue-950 font-bold font-mono">§ I.</span>
              <div className="h-1 w-full bg-blue-900/20 rounded-xs" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[6.5px] text-blue-950 font-bold font-mono">§ II.</span>
              <div className="h-1 w-full bg-blue-900/20 rounded-xs" />
            </div>
          </div>
        </div>
      );

    case 'vibrant_creative':
      return (
        <div className="w-full h-[72px] rounded-xl border-2 border-emerald-300 bg-[#f0fdf4] p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs select-none">
          {/* Bubble Header */}
          <div className="flex items-center justify-between">
            <span className="bg-emerald-100 text-emerald-800 text-[7.5px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-200">
              🎈 Classroom Adventure
            </span>
            <span className="text-[7px] text-amber-700 font-bold bg-amber-100 px-1 rounded">⭐ XP</span>
          </div>
          {/* 3 Tilted Sticky Notes */}
          <div className="grid grid-cols-3 gap-1 my-0.5">
            <div className="bg-emerald-100/90 border border-emerald-300 rounded-md p-1 transform -rotate-3 shadow-2xs">
              <div className="flex items-center gap-0.5 mb-0.5">
                <span className="text-[6px]">📌</span>
                <div className="h-1 w-full bg-emerald-800/60 rounded-xs" />
              </div>
              <div className="h-0.5 w-3/4 bg-emerald-700/40 rounded-xs" />
            </div>
            <div className="bg-amber-100/90 border border-amber-300 rounded-md p-1 transform rotate-2 shadow-2xs">
              <div className="flex items-center gap-0.5 mb-0.5">
                <span className="text-[6px]">💡</span>
                <div className="h-1 w-full bg-amber-900/60 rounded-xs" />
              </div>
              <div className="h-0.5 w-3/4 bg-amber-700/40 rounded-xs" />
            </div>
            <div className="bg-rose-100/90 border border-rose-300 rounded-md p-1 transform -rotate-2 shadow-2xs">
              <div className="flex items-center gap-0.5 mb-0.5">
                <span className="text-[6px]">🎯</span>
                <div className="h-1 w-full bg-rose-900/60 rounded-xs" />
              </div>
              <div className="h-0.5 w-3/4 bg-rose-700/40 rounded-xs" />
            </div>
          </div>
          {/* Footer */}
          <div className="flex justify-between items-center text-[6.5px] text-emerald-800 font-bold border-t border-emerald-200/60 pt-0.5">
            <span>Sticky Pinboard Grid</span>
            <span className="text-amber-700">Playful Workshop</span>
          </div>
        </div>
      );

    case 'stem_blueprint':
      return (
        <div
          className="w-full h-[72px] rounded border border-cyan-500/50 bg-[#031826] p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs font-mono relative select-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(6,182,212,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.12) 1px, transparent 1px)',
            backgroundSize: '10px 10px',
          }}
        >
          {/* Corner Coordinate Stamps */}
          <span className="absolute top-0.5 left-0.5 text-[6px] text-cyan-500 opacity-60">+</span>
          <span className="absolute top-0.5 right-0.5 text-[6px] text-cyan-500 opacity-60">+</span>
          <div className="flex items-center justify-between border-b border-cyan-500/30 pb-0.5">
            <span className="text-[7.5px] text-cyan-300 font-bold">[DWG: CAD-42]</span>
            <span className="text-[6.5px] text-cyan-400 bg-cyan-950 border border-cyan-800 px-1 rounded">±0.01%</span>
          </div>
          {/* Formula Sidebar + Viewport */}
          <div className="grid grid-cols-2 gap-1.5 my-auto">
            <div className="border border-cyan-500/30 bg-slate-950/80 p-1 rounded text-[6.5px] text-cyan-200">
              <div className="text-cyan-400 font-bold">Qd = f(P, Y)</div>
              <div className="text-slate-400 text-[5.5px]">∂Q/∂P &lt; 0 (Vector)</div>
            </div>
            <div className="border border-cyan-500/30 bg-slate-950/80 p-0.5 rounded flex items-center justify-center relative">
              <div className="w-10 h-4 border-b border-l border-cyan-500/60 relative">
                <div className="absolute inset-0 border-b border-rose-400/80 transform -rotate-15" />
                <div className="absolute inset-0 border-b border-emerald-400/80 transform rotate-15" />
              </div>
            </div>
          </div>
          {/* Footer */}
          <div className="text-[6px] text-cyan-500 flex justify-between border-t border-cyan-500/20 pt-0.5">
            <span>ISO-STEM TELEMETRY</span>
            <span>[X:04, Y:12]</span>
          </div>
        </div>
      );

    case 'warm_editorial':
      return (
        <div className="w-full h-[72px] rounded-lg border border-stone-300 bg-[#fcfaf7] p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs font-serif select-none">
          {/* Masthead */}
          <div className="flex items-center justify-between border-b border-stone-400/60 pb-0.5">
            <span className="text-[7.5px] font-bold text-stone-900 tracking-wider italic">THE ACADEMIC OBSERVER</span>
            <span className="text-[6.5px] text-orange-950 font-bold">No. 1</span>
          </div>
          {/* 7/5 Asymmetrical Monograph Split with Drop Cap */}
          <div className="grid grid-cols-12 gap-1.5 my-auto items-center">
            <div className="col-span-7 space-y-0.5">
              <div className="flex items-start gap-1">
                <span className="text-[12px] font-bold text-stone-950 leading-none">O</span>
                <div className="space-y-0.5 w-full">
                  <div className="h-1 w-full bg-stone-800 rounded-xs" />
                  <div className="h-0.5 w-4/5 bg-stone-500 rounded-xs" />
                </div>
              </div>
              <div className="border-l-2 border-orange-800 pl-1">
                <div className="h-0.5 w-full bg-orange-900/60 rounded-xs" />
              </div>
            </div>
            <div className="col-span-5 border border-stone-300 bg-white p-0.5 flex flex-col items-center justify-center shadow-2xs">
              <div className="h-5 w-full bg-stone-200 rounded-xs mb-0.5" />
              <div className="h-0.5 w-10 bg-stone-400 rounded-xs" />
            </div>
          </div>
          {/* Footer */}
          <div className="text-[6px] text-stone-500 font-sans flex justify-between border-t border-stone-200 pt-0.5">
            <span>EDITORIAL SPREAD</span>
            <span>DROP-CAP MONOGRAPH</span>
          </div>
        </div>
      );

    case 'minimalist_clean':
      return (
        <div className="w-full h-[72px] rounded-none border border-black bg-white p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs font-sans select-none">
          {/* Swiss Top Line */}
          <div className="flex items-center justify-between border-b border-black pb-0.5 text-[7.5px] font-mono">
            <span className="font-bold text-black">01 / SPECIFICATION</span>
            <span className="text-slate-600">DECK</span>
          </div>
          {/* Stark 3-Index Numbered Columns */}
          <div className="grid grid-cols-3 gap-1 border-t border-slate-200 pt-1 my-auto">
            <div className="border-r border-slate-300 pr-1">
              <span className="text-[10px] font-mono font-bold text-black block leading-none">01</span>
              <div className="h-0.5 w-full bg-black rounded-none mt-0.5" />
            </div>
            <div className="border-r border-slate-300 pr-1">
              <span className="text-[10px] font-mono font-bold text-black block leading-none">02</span>
              <div className="h-0.5 w-full bg-black rounded-none mt-0.5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-black block leading-none">03</span>
              <div className="h-0.5 w-full bg-black rounded-none mt-0.5" />
            </div>
          </div>
          {/* Footer */}
          <div className="text-[6px] font-mono text-slate-700 flex justify-between border-t border-black pt-0.5">
            <span>SWISS MINIMAL</span>
            <span>0px SHARP RULES</span>
          </div>
        </div>
      );

    case 'infographic_visual':
      return (
        <div className="w-full h-[72px] rounded-lg border border-sky-500/40 bg-[#060b19] p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs font-sans select-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sky-500/30 pb-0.5">
            <span className="text-[7.5px] font-bold text-sky-300">📊 INFOGRAPHIC FLOW</span>
            <span className="text-[6.5px] text-sky-400 font-mono">3 STAGES</span>
          </div>
          {/* 3-Step Connected Milestone Pipeline */}
          <div className="flex items-center justify-between gap-1 my-auto px-1">
            <div className="flex items-center gap-1">
              <div className="size-3.5 bg-sky-500 text-black font-bold text-[7px] rounded-full flex items-center justify-center">1</div>
              <div className="h-1 w-3.5 bg-sky-500/50 rounded-xs" />
            </div>
            <span className="text-[7px] text-sky-400">➔</span>
            <div className="flex items-center gap-1">
              <div className="size-3.5 bg-cyan-400 text-black font-bold text-[7px] rounded-full flex items-center justify-center">2</div>
              <div className="h-1 w-3.5 bg-cyan-400/50 rounded-xs" />
            </div>
            <span className="text-[7px] text-sky-400">➔</span>
            <div className="flex items-center gap-1">
              <div className="size-3.5 bg-emerald-400 text-black font-bold text-[7px] rounded-full flex items-center justify-center">3</div>
              <div className="h-1 w-3.5 bg-emerald-400/50 rounded-xs" />
            </div>
          </div>
          {/* Footer */}
          <div className="text-[6px] font-mono text-sky-400 flex justify-between border-t border-sky-500/20 pt-0.5">
            <span>PROCESS ROADMAP</span>
            <span>KPI METRICS</span>
          </div>
        </div>
      );

    case 'gamified_quest':
      return (
        <div className="w-full h-[72px] rounded-xl border border-purple-500/60 bg-[#110722] p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs font-sans select-none">
          {/* HUD Header */}
          <div className="flex items-center justify-between border-b border-purple-500/40 pb-0.5">
            <span className="text-[7.5px] font-bold text-amber-300 flex items-center gap-0.5">⚔️ QUEST HUD</span>
            <span className="text-[6.5px] font-mono text-amber-400">+500 XP</span>
          </div>
          {/* 3 RPG Mission Cards */}
          <div className="grid grid-cols-3 gap-1 my-auto">
            <div className="border border-purple-500/40 bg-purple-950/80 p-0.5 rounded shadow-xs">
              <span className="text-[5.5px] text-amber-400 font-bold block">MISSION 01</span>
              <div className="h-0.5 w-full bg-purple-400/60 rounded-xs mt-0.5" />
            </div>
            <div className="border border-purple-500/40 bg-purple-950/80 p-0.5 rounded shadow-xs">
              <span className="text-[5.5px] text-amber-400 font-bold block">MISSION 02</span>
              <div className="h-0.5 w-full bg-purple-400/60 rounded-xs mt-0.5" />
            </div>
            <div className="border border-purple-500/40 bg-purple-950/80 p-0.5 rounded shadow-xs">
              <span className="text-[5.5px] text-rose-400 font-bold block">BOSS BATTLE</span>
              <div className="h-0.5 w-full bg-rose-400/60 rounded-xs mt-0.5" />
            </div>
          </div>
          {/* Footer */}
          <div className="text-[6px] font-mono text-purple-300 flex justify-between border-t border-purple-500/20 pt-0.5">
            <span>RPG QUEST SYSTEM</span>
            <span className="text-amber-400">⭐ LEVEL UP</span>
          </div>
        </div>
      );

    case 'modern_tech':
    default:
      return (
        <div className="w-full h-[72px] rounded-lg border border-indigo-500/40 bg-[#0b0f19] p-1.5 flex flex-col justify-between overflow-hidden shadow-2xs font-sans select-none">
          {/* Cyber Telemetry Header */}
          <div className="flex items-center justify-between border-b border-indigo-500/30 pb-0.5">
            <div className="flex items-center gap-1">
              <span className="size-1 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[7.5px] font-mono text-indigo-300 font-bold">SYS_ONLINE</span>
            </div>
            <span className="text-[6.5px] font-mono text-cyan-400">v4.2</span>
          </div>
          {/* 3 Modular Bento Cards */}
          <div className="grid grid-cols-3 gap-1 my-auto">
            <div className="border border-indigo-500/30 bg-slate-900/80 p-0.5 rounded shadow-xs">
              <span className="text-[5.5px] font-mono text-indigo-400 font-bold block">AXIOM_01</span>
              <div className="h-0.5 w-full bg-indigo-300/40 rounded-xs mt-0.5" />
            </div>
            <div className="border border-indigo-500/30 bg-slate-900/80 p-0.5 rounded shadow-xs">
              <span className="text-[5.5px] font-mono text-indigo-400 font-bold block">AXIOM_02</span>
              <div className="h-0.5 w-full bg-indigo-300/40 rounded-xs mt-0.5" />
            </div>
            <div className="border border-indigo-500/30 bg-slate-900/80 p-0.5 rounded shadow-xs">
              <span className="text-[5.5px] font-mono text-indigo-400 font-bold block">AXIOM_03</span>
              <div className="h-0.5 w-full bg-indigo-300/40 rounded-xs mt-0.5" />
            </div>
          </div>
          {/* Footer */}
          <div className="text-[6px] font-mono text-slate-500 flex justify-between border-t border-indigo-500/20 pt-0.5">
            <span>CYBER BENTO DECK</span>
            <span className="text-cyan-400">GLASSMORPHISM</span>
          </div>
        </div>
      );
  }
}
