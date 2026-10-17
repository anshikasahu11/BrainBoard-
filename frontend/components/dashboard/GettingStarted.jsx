"use client";

import Link from "next/link";
import { ArrowRight, Circle, CircleCheck } from "lucide-react";
import DashboardCard from "@/components/dashboard/DashboardCard";
import useWorkspace from "@/hooks/useWorkspace";
import { assignableRoles } from "@/lib/permissions";

const ROW = "-mx-2 flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-white/5";

function Step({ step }) {
  const Icon = step.done ? CircleCheck : Circle;
  const actionable = !step.done && (step.href || step.onClick);

  const inner = (
    <>
      <Icon
        size={18}
        strokeWidth={1.5}
        className={step.done ? "shrink-0 text-success" : "shrink-0 text-fg-muted"}
        aria-hidden="true"
      />
      <span
        className={`min-w-0 flex-1 text-[14px] ${
          step.done ? "text-fg-muted line-through decoration-white/30" : ""
        }`}
      >
        <span className="sr-only">{step.done ? "Completed: " : "To do: "}</span>
        {step.label}
        {step.note && <span className="ml-2 text-[12px] text-fg-muted">{step.note}</span>}
      </span>
      {step.soon && <span className="soon-chip">Soon</span>}
      {actionable && (
        <ArrowRight size={15} strokeWidth={1.5} className="shrink-0 text-fg-2" aria-hidden="true" />
      )}
    </>
  );

  return (
    <li>
      {actionable && step.href && (
        <Link href={step.href} className={ROW}>
          {inner}
        </Link>
      )}
      {actionable && !step.href && (
        <button type="button" onClick={step.onClick} disabled={step.busy} className={ROW}>
          {inner}
        </button>
      )}
      {!actionable && <div className="flex items-center gap-3 py-2.5">{inner}</div>}
    </li>
  );
}

// recent: the object from useRecentDocuments. The "document" step is ticked from
// real data, so it follows reality (delete every document and it un-ticks).
export default function GettingStarted({ recent, onCreateDocument, creatingDocument }) {
  const { workspace, role } = useWorkspace();
  const canInvite = assignableRoles(role).length > 0;

  const hasDocuments = recent.status === "ready" && recent.documents.length > 0;

  // Later phases add real steps here (and remove `soon`) as features land.
  const steps = [
    { key: "create", label: "Create your workspace", done: true },
    {
      key: "team",
      label: "Add a teammate",
      done: workspace.memberCount > 1,
      href: canInvite ? `/workspaces/${workspace.id}/members` : null,
      note: canInvite ? null : "Ask an owner or admin",
    },
    {
      key: "document",
      label: "Write your first document",
      done: hasDocuments,
      onClick: onCreateDocument,
      busy: creatingDocument,
    },
    { key: "task", label: "Create a task", soon: true },
    { key: "snippet", label: "Save a code snippet", soon: true },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const ratio = doneCount / steps.length;

  return (
    <DashboardCard title="Getting started" meta={`${doneCount} of ${steps.length} complete`}>
      <div
        className="progress-track mb-3"
        role="progressbar"
        aria-label="Getting started progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div className="progress-fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>

      <ul className="divide-y divide-white/5">
        {steps.map((step) => (
          <Step key={step.key} step={step} />
        ))}
      </ul>
    </DashboardCard>
  );
}