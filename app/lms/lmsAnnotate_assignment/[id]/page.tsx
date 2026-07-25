import ReviewClient from "./ReviewClient";

// Next.js 16 App Router: `params` is a Promise. This thin server component
// resolves the route id and hands it to the client grading screen.
export default async function ReviewAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewClient assignmentId={Number(id)} />;
}
