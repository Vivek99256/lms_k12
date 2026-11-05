import { redirect } from "next/navigation";
import { AVAILABLE_VERSIONS } from "@/lib/docs/docs-types";

export default function DocsRootPage() {
  const latest = AVAILABLE_VERSIONS.find((v) => v.isLatest) || AVAILABLE_VERSIONS[0];
  redirect(`/docs/${latest.version}`);
}
