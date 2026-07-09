"use client";
// components/ChartPanel.tsx
interface ChartPanelProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function ChartPanel({ title, subtitle, children }: ChartPanelProps) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col h-full">
      <div className="mb-4 shrink-0">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-1 min-h-0 w-full">
        {children}
      </div>
    </div>
  );
}
