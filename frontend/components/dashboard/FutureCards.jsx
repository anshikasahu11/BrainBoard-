import { Kanban, UserCheck } from "lucide-react";
import DashboardCard, { EmptyHint } from "@/components/dashboard/DashboardCard";

// Two cards still waiting for their feature. Each is replaced by a real
// component when its phase lands: Tasks (Phase 6).

export function AssignedCard() {
  return (
    <DashboardCard title="Assigned to you" soon featured>
      <EmptyHint icon={UserCheck} title="Nothing assigned yet">
        Tasks assigned to you will show up here, so you always know what&apos;s next.
      </EmptyHint>
    </DashboardCard>
  );
}

export function RecentTasksCard() {
  return (
    <DashboardCard title="Recent tasks" soon>
      <EmptyHint icon={Kanban} title="No tasks yet">
        Newly created and recently updated tasks will appear here.
      </EmptyHint>
    </DashboardCard>
  );
}