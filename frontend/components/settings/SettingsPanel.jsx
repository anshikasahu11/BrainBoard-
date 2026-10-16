"use client";

import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import RenameForm from "@/components/settings/RenameForm";
import DangerZone from "@/components/settings/DangerZone";

export default function SettingsPanel() {
  return (
    <div>
      <PageHeading
        eyebrow="Settings"
        title="Workspace settings"
        description="Manage how this workspace looks and who it belongs to."
      />

      <div className="mt-10 max-w-xl space-y-6">
        <Reveal level="balanced" delay={0.25}>
          <section aria-labelledby="general-heading" className="glass rounded-card p-5 sm:p-6">
            <h2 id="general-heading" className="mb-5 font-display text-3xl leading-[1.1]">
              General
            </h2>
            <RenameForm />
          </section>
        </Reveal>

        <Reveal level="balanced" delay={0.35}>
          <section aria-labelledby="danger-heading" className="danger-card space-y-6 rounded-card p-5 sm:p-6">
            <h2 id="danger-heading" className="font-display text-3xl leading-[1.1]">
              Danger zone
            </h2>
            <DangerZone />
          </section>
        </Reveal>
      </div>
    </div>
  );
}