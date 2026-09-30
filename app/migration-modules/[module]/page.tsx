import { MigrationModulePage } from '../MigrationModulePage';

export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return <MigrationModulePage module={module} />;
}
