import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dashboard } from "@/components/dashboard";
import { Directories } from "@/components/directories";
import { ScheduleView } from "@/components/schedule";
import { Permissions } from "@/components/permissions";
import { Exclusions } from "@/components/exclusions";
import { useConfig } from "@/hooks/use-config";
import { useAppState } from "@/hooks/use-state";

function App() {
  const { config, loading: configLoading, saveConfig } = useConfig();
  const { state, loading: stateLoading, reload: reloadState } = useAppState();

  if (configLoading || stateLoading || !config || !state) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground p-4">
      <h1 className="text-lg font-semibold mb-4">Cargo Cleaner</h1>
      <Tabs defaultValue="dashboard" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="directories">Directories</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="exclusions">Exclusions</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="flex-1 overflow-auto">
          <Dashboard state={state} config={config} onCleanComplete={reloadState} onRefresh={reloadState} />
        </TabsContent>
        <TabsContent value="directories" className="flex-1 overflow-auto">
          <Directories config={config} onSave={saveConfig} />
        </TabsContent>
        <TabsContent value="schedule" className="flex-1 overflow-auto">
          <ScheduleView config={config} onSave={saveConfig} lastRun={state.last_run} />
        </TabsContent>
        <TabsContent value="permissions" className="flex-1 overflow-auto">
          <Permissions config={config} onSave={saveConfig} />
        </TabsContent>
        <TabsContent value="exclusions" className="flex-1 overflow-auto">
          <Exclusions config={config} onSave={saveConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
