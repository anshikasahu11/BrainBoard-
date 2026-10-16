"use client";

import { useEffect, useState } from "react";
import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import AddMemberForm from "@/components/members/AddMemberForm";
import MemberRow from "@/components/members/MemberRow";
import useAuth from "@/hooks/useAuth";
import useWorkspace from "@/hooks/useWorkspace";
import {
  listMembersRequest,
  updateMemberRoleRequest,
  removeMemberRequest,
} from "@/services/memberService";
import { assignableRoles, canChangeRoles, canRemoveMember } from "@/lib/permissions";

const ORDER = { owner: 0, admin: 1, member: 2 };

// Owner first, then admins, then members. Earlier joiners first within a role.
function sortMembers(list) {
  return [...list].sort(
    (a, b) => ORDER[a.role] - ORDER[b.role] || new Date(a.joinedAt) - new Date(b.joinedAt)
  );
}

export default function MembersPanel() {
  const { workspace, role, patchWorkspace } = useWorkspace();
  const { user } = useAuth();

  const [state, setState] = useState({ status: "loading", members: [], error: "" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const [rowError, setRowError] = useState("");
  const [changingId, setChangingId] = useState(null);

  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const addRoles = assignableRoles(role);
  const mayChangeRoles = canChangeRoles(role);

  useEffect(() => {
    let cancelled = false;

    listMembersRequest(workspace.id)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", members: sortMembers(data.members), error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", members: [], error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [workspace.id, attempt]);

  function retry() {
    setState({ status: "loading", members: [], error: "" });
    setAttempt((n) => n + 1);
  }

  function handleAdded(member) {
    setState((current) => {
      const members = sortMembers([...current.members, member]);
      patchWorkspace({ memberCount: members.length });
      return { ...current, members };
    });
    setRowError("");
    setNotice(`${member.name} was added as ${member.role}.`);
  }

  async function handleRoleChange(member, newRole) {
    setChangingId(member.id);
    setRowError("");
    setNotice("");

    try {
      const { member: updated } = await updateMemberRoleRequest(workspace.id, member.id, {
        role: newRole,
      });
      setState((current) => ({
        ...current,
        members: sortMembers(current.members.map((m) => (m.id === updated.id ? updated : m))),
      }));
      setNotice(`${updated.name} is now ${updated.role === "admin" ? "an admin" : "a member"}.`);
    } catch (error) {
      // The dropdown is driven by the list, so it simply stays on the old role.
      setRowError(error.message);
    } finally {
      setChangingId(null);
    }
  }

  function dropMember(member) {
    setState((current) => {
      const members = current.members.filter((m) => m.id !== member.id);
      patchWorkspace({ memberCount: members.length });
      return { ...current, members };
    });
  }

  async function confirmRemoval() {
    const member = pendingRemoval;
    setRemoving(true);
    setRemoveError("");

    try {
      await removeMemberRequest(workspace.id, member.id);
      dropMember(member);
      setNotice(`${member.name} was removed.`);
      setPendingRemoval(null);
    } catch (error) {
      if (error.status === 404) {
        // Already gone (someone else removed them). Just tidy the list.
        dropMember(member);
        setPendingRemoval(null);
      } else {
        setRemoveError(error.message);
      }
    } finally {
      setRemoving(false);
    }
  }

  const description =
    addRoles.length > 0
      ? "Add people by email, and manage what they can do."
      : "Everyone who has access to this workspace.";

  return (
    <div>
      <PageHeading eyebrow="Members" title="Your team" description={description} />

      {/* Polite announcements for screen readers, and a quiet confirmation for everyone. */}
      <p role="status" aria-live="polite" className="mt-6 min-h-5 text-[13px] text-success">
        {notice}
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <Reveal level="balanced" delay={0.25}>
          <div className="glass rounded-card p-5 sm:p-6">
            <h2 className="mb-5 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-2">
              {state.status === "ready"
                ? `${state.members.length} ${state.members.length === 1 ? "person" : "people"}`
                : "People"}
            </h2>

            {state.status === "loading" && (
              <div className="space-y-3" role="status" aria-live="polite">
                <div className="skeleton h-14 rounded-card" />
                <div className="skeleton h-14 rounded-card" />
                <span className="sr-only">Loading members</span>
              </div>
            )}

            {state.status === "error" && (
              <div className="space-y-4">
                <FormAlert message={state.error} />
                <button
                  type="button"
                  onClick={retry}
                  className="btn-ghost inline-flex items-center rounded-control px-4 py-2 text-sm"
                >
                  Try again
                </button>
              </div>
            )}

            {state.status === "ready" && (
              <>
                {rowError && (
                  <div className="mb-4">
                    <FormAlert message={rowError} />
                  </div>
                )}

                <ul>
                  {state.members.map((member) => {
                    const isSelf = member.id === user.id;
                    const changeable = mayChangeRoles && !isSelf && member.role !== "owner";
                    const removable = !isSelf && canRemoveMember(role, member.role);

                    return (
                      <MemberRow
                        key={member.id}
                        member={member}
                        isSelf={isSelf}
                        roleOptions={changeable ? ["admin", "member"] : null}
                        busy={changingId === member.id}
                        onRoleChange={handleRoleChange}
                        onRemove={
                          removable
                            ? (m) => {
                                setRemoveError("");
                                setPendingRemoval(m);
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </Reveal>

        {addRoles.length > 0 ? (
          <Reveal level="balanced" delay={0.35}>
            <section aria-labelledby="add-member-heading" className="glass rounded-card p-5 sm:p-6">
              <h2 id="add-member-heading" className="font-display text-3xl leading-[1.1]">
                Add a member
              </h2>
              <div className="mt-5">
                <AddMemberForm workspaceId={workspace.id} roles={addRoles} onAdded={handleAdded} />
              </div>
            </section>
          </Reveal>
        ) : (
          <Reveal level="balanced" delay={0.35}>
            <div className="glass rounded-card p-5 text-[13px] leading-relaxed text-fg-2">
              Only the owner and admins can add or remove people.
            </div>
          </Reveal>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove this member?"
        description={
          pendingRemoval
            ? `${pendingRemoval.name} will lose access to ${workspace.name}. You can add them back later.`
            : ""
        }
        confirmLabel="Remove"
        loadingLabel="Removing…"
        danger
        loading={removing}
        error={removeError}
        onConfirm={confirmRemoval}
        onCancel={() => !removing && setPendingRemoval(null)}
      />
    </div>
  );
}