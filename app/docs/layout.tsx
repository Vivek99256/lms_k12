import React from "react";
import "@/components/docs/docs.css";

export const metadata = {
  title: "Scholar Documentation Portal",
  description: "Official Multi-Version Documentation Portal for Scholar Suite.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors antialiased">
      {children}
    </div>
  );
}

