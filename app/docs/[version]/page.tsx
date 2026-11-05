import fs from "fs";
import matter from "gray-matter";
import { notFound } from "next/navigation";
import { AVAILABLE_VERSIONS } from "@/lib/docs/docs-types";
import { 
  buildDocNavTree, 
  flattenDocNav, 
  extractTocFromMarkdown, 
  renderMarkdownToHtml, 
  resolveDocFilePath 
} from "@/lib/docs/docs-service";
import { DocHeader } from "@/components/docs/DocHeader";
import { DocSidebar } from "@/components/docs/DocSidebar";
import { DocToc } from "@/components/docs/DocToc";
import { DocViewer } from "@/components/docs/DocViewer";

interface VersionDocPageProps {
  params: Promise<{
    version: string;
    slug?: string[];
  }>;
}

export async function generateMetadata({ params }: VersionDocPageProps) {
  const { version, slug } = await params;
  const filePath = resolveDocFilePath(version, slug || []);

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      title: `Documentation v${version} | Scholar`,
    };
  }

  try {
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(rawContent);
    const h1Match = content.match(/^#\s+(.+)$/m);
    const title = data.title || (h1Match ? h1Match[1] : slug?.slice(-1)[0] || "Overview");

    return {
      title: `${title} – Scholar Docs v${version}`,
      description: data.description || "Scholar Multi-Version Documentation Portal",
    };
  } catch {
    return {
      title: `Documentation v${version} | Scholar`,
    };
  }
}

export default async function VersionDocPage({ params }: VersionDocPageProps) {
  const { version, slug } = await params;

  // Validate version: accepts 1.0.0 or v1
  const isValidVersion = AVAILABLE_VERSIONS.some((v) => v.version === version) || version === "v1";
  if (!isValidVersion) {
    notFound();
  }

  const filePath = resolveDocFilePath(version, slug || []);
  if (!filePath || !fs.existsSync(filePath)) {
    notFound();
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  // Extract Title
  const h1Match = content.match(/^#\s+(.+)$/m);
  const pageTitle = data.title || (h1Match ? h1Match[1] : (slug && slug.length > 0 ? slug[slug.length - 1] : "Scholar Suite v1 Product Bible"));

  // Build Table of Contents
  const toc = extractTocFromMarkdown(content);

  // Render to HTML with remark/rehype plugins
  const htmlContent = await renderMarkdownToHtml(content);

  // Navigation tree for sidebar
  const navTree = buildDocNavTree(version);

  // Linear nav for Previous / Next document buttons
  const flatNav = flattenDocNav(navTree);
  const currentHref = slug && slug.length > 0 ? `/docs/${version}/${slug.join("/")}` : `/docs/${version}`;
  const currentIndex = flatNav.findIndex((item) => item.href.toLowerCase() === currentHref.toLowerCase());

  const prevDoc = currentIndex > 0 ? flatNav[currentIndex - 1] : null;
  const nextDoc = currentIndex !== -1 && currentIndex < flatNav.length - 1 ? flatNav[currentIndex + 1] : null;

  return (
    <div className="flex flex-col min-h-screen">
      <DocHeader version={version} />

      <div className="flex-1 flex max-w-full w-full mx-auto px-2 sm:px-4">
        {/* Left Sidebar (Desktop) */}
        <div className="hidden md:block">
          <DocSidebar items={navTree} version={version} />
        </div>

        {/* Center Main Content Area */}
        <main className="flex-1 min-w-0 flex justify-center overflow-x-hidden">
          <DocViewer
            title={pageTitle}
            version={version}
            htmlContent={htmlContent}
            prevDoc={prevDoc}
            nextDoc={nextDoc}
            meta={data}
          />
        </main>

        {/* Right Sidebar: Table of Contents */}
        <DocToc toc={toc} />
      </div>
    </div>
  );
}
