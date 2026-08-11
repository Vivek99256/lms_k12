import { MigrationModulePage } from '../MigrationModulePage';

export default async function Page({ params }: PageProps<'/migration-modules/[module]'>) {
  const { module } = await params;
  return <MigrationModulePage module={module} />;
}
