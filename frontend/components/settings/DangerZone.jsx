"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TextField from "@/components/auth/TextField";
import useAuth from "@/hooks/useAuth";
import useWorkspace from "@/hooks/useWorkspace";
import { deleteWorkspaceRequest } from "@/services/workspaceService";
import { removeMemberRequest } from "@/services/memberService";
import { clearLastWorkspace } from "@/lib/lastWorkspace";
import { canDeleteWorkspace, canLeaveWorkspace } from "@/lib/permissions";

export default function DangerZone() {
  const { workspace, role } = useWorkspace();
  const { user } = useAuth();
  const router = useRouter();

  const [dialog, setDialog] = useState(null); // "delete" | "leave" | null
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open(kind) {
    setTyped("");
    setError("");
    setDialog(kind);
  }

  function close() {
    if (!busy) setDialog(null);
  }

  async function confirm() {
    setBusy(true);
    setError("");

    try {
      if (dialog === "delete") await deleteWorkspaceRequest(workspace.id);
      else await removeMemberRequest(workspace.id, user.id); // removing yourself = leaving

      clearLastWorkspace(workspace.id);
      // Leave "busy" on so the button doesn't flicker during navigation.
      router.replace("/workspaces");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const deleting = dialog === "delete";

  return (
    <>
      {canDeleteWorkspace(role) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 basis-64">
            <h3 className="text-[15px] font-medium">Delete this workspace</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
              Permanently removes the workspace and everything in it for every member. This can&apos;t
              be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => open("delete")}
            className="btn-danger inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Delete workspace
          </button>
        </div>
      )}

      {canLeaveWorkspace(role) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 basis-64">
            <h3 className="text-[15px] font-medium">Leave this workspace</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
              You&apos;ll lose access straight away. An owner or admin can add you back.
            </p>
          </div>
          <button
            type="button"
            onClick={() => open("leave")}
            className="btn-danger inline-flex items-center rounded-control px-4 py-2 text-sm"
          >
            Leave workspace
          </button>
        </div>
      )}

      <ConfirmDialog
        open={dialog !== null}
        title={deleting ? "Delete this workspace?" : "Leave this workspace?"}
        description={
          deleting
            ? `This permanently deletes ${workspace.name} for everyone. To continue, type its name below.`
            : `You'll lose access to ${workspace.name}.`
        }
        confirmLabel={deleting ? "Delete forever" : "Leave"}
        loadingLabel={deleting ? "Deleting…" : "Leaving…"}
        danger
        loading={busy}
        confirmDisabled={deleting && typed !== workspace.name}
        error={error}
        onConfirm={confirm}
        onCancel={close}
      >
        {deleting && (
          <TextField
            label={`Type "${workspace.name}" to confirm`}
            name="confirm-name"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            disabled={busy}
          />
        )}
      </ConfirmDialog>
    </>
  );
}