import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import {
  DocNavItem,
  DocTocItem,
  SearchDocResult,
  AVAILABLE_VERSIONS,
} from "./docs-types";

export { AVAILABLE_VERSIONS };
export type { DocNavItem, DocTocItem, SearchDocResult };

const DOCS_BASE_DIR = path.join(process.cwd(), "docs");

// Resolve physical disk directory for a version (1.0.0 maps directly to docs/v1)
export function getDocsVersionDir(version: string): string {
  if (version === "1.0.0" || version === "v1" || version === "1") {
    return path.join(DOCS_BASE_DIR, "v1");
  }

  const direct = path.join(DOCS_BASE_DIR, version);
  if (
    fs.existsSync(/*turbopackIgnore: true*/ direct) &&
    fs.statSync(/*turbopackIgnore: true*/ direct).isDirectory()
  ) {
    return direct;
  }

  // Fallback to docs/v1
  return path.join(DOCS_BASE_DIR, "v1");
}

function formatTitleFromSlug(filename: string): string {
  const clean = filename.replace(/\.(md|mdx)$/, "").replace(/^[0-9]+[_-]/, "");
  return clean
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function buildDocNavTree(version: string, currentDir?: string, relativeUrlPrefix = ""): DocNavItem[] {
  const baseDir = currentDir || getDocsVersionDir(version);
  if (!fs.existsSync(/*turbopackIgnore: true*/ baseDir)) return [];

  const entries = fs.readdirSync(/*turbopackIgnore: true*/ baseDir, { withFileTypes: true });
  const items: DocNavItem[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name.startsWith("~$")) {
      continue;
    }

    const fullPath = path.join(/*turbopackIgnore: true*/ baseDir, entry.name);

    if (entry.isDirectory()) {
      const subPrefix = relativeUrlPrefix ? `${relativeUrlPrefix}/${entry.name}` : entry.name;
      const subItems = buildDocNavTree(version, fullPath, subPrefix);
      if (subItems.length > 0) {
        items.push({
          title: formatTitleFromSlug(entry.name),
          slug: entry.name,
          path: fullPath,
          href: `/docs/${version}/${subPrefix}`,
          children: subItems,
        });
      }
    } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
      const isIndex = /^readme\.(md|mdx)$/i.test(entry.name);
      let pageTitle = formatTitleFromSlug(entry.name);

      try {
        const fileContent = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, "utf-8");
        const { data, content } = matter(fileContent);
        if (data.title) {
          pageTitle = cleanTitleText(data.title);
        } else {
          const h1Match = content.match(/^#\s+(.+)$/m);
          if (h1Match) {
            pageTitle = cleanTitleText(h1Match[1].trim());
          }
        }
      } catch (e) {
        // Fallback to formatted filename
      }
      pageTitle = cleanTitleText(pageTitle);

      const slugName = entry.name.replace(/\.(md|mdx)$/, "");
      const hrefSlug = isIndex
        ? relativeUrlPrefix
          ? `/docs/${version}/${relativeUrlPrefix}`
          : `/docs/${version}`
        : relativeUrlPrefix
        ? `/docs/${version}/${relativeUrlPrefix}/${slugName}`
        : `/docs/${version}/${slugName}`;

      items.push({
        title: pageTitle,
        slug: slugName,
        path: fullPath,
        href: hrefSlug,
        isIndex,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.isIndex && !b.isIndex) return -1;
    if (!a.isIndex && b.isIndex) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function flattenDocNav(items: DocNavItem[]): Array<{ title: string; href: string }> {
  let list: Array<{ title: string; href: string }> = [];
  for (const item of items) {
    if (!item.children || item.children.length === 0) {
      list.push({ title: item.title, href: item.href });
    } else {
      list = list.concat(flattenDocNav(item.children));
    }
  }
  return list;
}

export function extractTocFromMarkdown(content: string): DocTocItem[] {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const toc: DocTocItem[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const rawText = match[2].trim();
    const cleanText = rawText
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_]/g, "")
      .trim();

    const id = cleanText
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    toc.push({
      id,
      text: cleanText,
      level,
    });
  }

  return toc;
}

function cleanMarkdownText(text: string): string {
  return text
    // Replace em dash, en dash, quotes, and common Unicode characters with ASCII equivalents
    .replace(/\u2014/g, " - ")
    .replace(/\u2013/g, " - ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\uFFFD/g, " - ")
    // Replace mojibake sequences
    .replace(/â€”/g, " - ")
    .replace(/â€“/g, " - ")
    .replace(/â€˜/g, "'")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"');
}

function cleanTitleText(text: string): string {
  return cleanMarkdownText(text)
    .replace(/\uFFFD/g, " - ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

export async function renderMarkdownToHtml(rawMarkdown: string): Promise<string> {
  const sanitizedMarkdown = cleanMarkdownText(rawMarkdown);
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
      properties: { className: ["heading-anchor"] },
    })
    .use(rehypeStringify);

  const file = await processor.process(sanitizedMarkdown);
  return String(file);
}

export function resolveDocFilePath(version: string, slugParts: string[]): string | null {
  const versionDir = getDocsVersionDir(version);

  if (!slugParts || slugParts.length === 0) {
    const rootReadme = path.join(versionDir, "README.md");
    if (fs.existsSync(/*turbopackIgnore: true*/ rootReadme)) return rootReadme;
    return null;
  }

  const relativePath = path.join(/*turbopackIgnore: true*/ ...slugParts);
  const directMd = path.join(/*turbopackIgnore: true*/ versionDir, `${relativePath}.md`);
  if (fs.existsSync(/*turbopackIgnore: true*/ directMd)) return directMd;

  const directMdx = path.join(/*turbopackIgnore: true*/ versionDir, `${relativePath}.mdx`);
  if (fs.existsSync(/*turbopackIgnore: true*/ directMdx)) return directMdx;

  const folderReadmeMd = path.join(/*turbopackIgnore: true*/ versionDir, relativePath, "README.md");
  if (fs.existsSync(/*turbopackIgnore: true*/ folderReadmeMd)) return folderReadmeMd;

  const folderReadmeMdx = path.join(/*turbopackIgnore: true*/ versionDir, relativePath, "README.mdx");
  if (fs.existsSync(/*turbopackIgnore: true*/ folderReadmeMdx)) return folderReadmeMdx;

  return null;
}

export function searchDocs(version: string, query: string): SearchDocResult[] {
  if (!query || query.trim().length < 2) return [];

  const lowerQ = query.toLowerCase().trim();
  const versionDir = getDocsVersionDir(version);
  const results: SearchDocResult[] = [];

  function traverse(dir: string, relPath = "") {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return;
    const entries = fs.readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name.startsWith("~$")) continue;

      const fullPath = path.join(/*turbopackIgnore: true*/ dir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath, relPath ? `${relPath}/${entry.name}` : entry.name);
      } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mdx"))) {
        try {
          const fileContent = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, "utf-8");
          const { data, content } = matter(fileContent);
          const title = data.title || formatTitleFromSlug(entry.name);
          const isIndex = /^readme\.(md|mdx)$/i.test(entry.name);
          const slugName = entry.name.replace(/\.(md|mdx)$/, "");
          const href = isIndex
            ? relPath
              ? `/docs/${version}/${relPath}`
              : `/docs/${version}`
            : relPath
            ? `/docs/${version}/${relPath}/${slugName}`
            : `/docs/${version}/${slugName}`;

          const category = relPath.split("/")[0] || "General";

          if (title.toLowerCase().includes(lowerQ) || content.toLowerCase().includes(lowerQ)) {
            let excerpt = "";
            const idx = content.toLowerCase().indexOf(lowerQ);
            if (idx !== -1) {
              const start = Math.max(0, idx - 60);
              const end = Math.min(content.length, idx + 140);
              excerpt = content.slice(start, end).replace(/[#*`_[\]]/g, " ").trim();
            } else {
              excerpt = content.slice(0, 160).replace(/[#*`_[\]]/g, " ").trim();
            }

            results.push({
              title,
              version,
              href,
              excerpt: `...${excerpt}...`,
              category: formatTitleFromSlug(category),
            });

            if (results.length >= 25) return;
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  traverse(versionDir);
  return results;
}
