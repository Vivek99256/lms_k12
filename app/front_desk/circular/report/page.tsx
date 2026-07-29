import ModuleWorkbench from '../../_components/ModuleWorkbench';
import { reportModules } from '../../_lib/reports';

export default function Page() {
  return <ModuleWorkbench module={reportModules.circularReport} />;
}

