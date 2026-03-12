import { useEffect, useMemo } from "react";
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

  // Refresh state whenever the window regains focus so we pick up changes
  // made by the CLI / LaunchAgent while the GUI was in the background.
  useEffect(() => {
    const onFocus = () => reloadState();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadState]);

  // Compute nextRun client-side so it updates instantly with no async round-trip.
  // Uses calendar-date logic to match the Rust scheduler: take last_run's local
  // date, add interval_days calendar days, then set the clock to preferred_time.
  // This means "daily at 13:00" always shows the next run at 13:00 tomorrow,
  // regardless of what time today's run actually happened.
  const nextRun = useMemo<string | null>(() => {
    if (!config || !state || !state.last_run) return null;
    const [hour, minute] = config.schedule.preferred_time.split(":").map(Number);
    const lastRun = new Date(state.last_run);
    const next = new Date(lastRun);
    next.setDate(next.getDate() + config.schedule.interval_days);
    next.setHours(hour, minute, 0, 0);
    return next.toISOString();
  }, [config?.schedule.interval_days, config?.schedule.preferred_time, state?.last_run]);

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
          <Dashboard state={state} config={config} nextRun={nextRun} onCleanComplete={reloadState} />
        </TabsContent>
        <TabsContent value="directories" className="flex-1 overflow-auto">
          <Directories config={config} onSave={saveConfig} />
        </TabsContent>
        <TabsContent value="schedule" className="flex-1 overflow-auto">
          <ScheduleView config={config} nextRun={nextRun} onSave={saveConfig} />
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
