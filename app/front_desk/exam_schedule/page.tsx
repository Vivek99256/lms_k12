import ModuleWorkbench from '../_components/ModuleWorkbench';
import { frontDeskModules } from '../_lib/modules';

export default function Page() {
  return <ModuleWorkbench module={frontDeskModules.examSchedule} />;
}

