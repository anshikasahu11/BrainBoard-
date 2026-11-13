"use client";

import { useEffect, useId, useState } from "react";
import { Clock } from "lucide-react";
import PageHeading from "@/components/app/PageHeading";
import Reveal from "@/components/Reveal";
import FormAlert from "@/components/auth/FormAlert";
import NotificationsNav from "@/components/notifications/NotificationsNav";
import Switch from "@/components/ui/Switch";
import useWorkspace from "@/hooks/useWorkspace";
import {
  describeZone,
  groupPreferences,
  supportedTimeZones,
  timeZoneOptions,
  zoneClock,
  zoneLabel,
} from "@/lib/notificationSettings";
import { browserTimeZone } from "@/lib/timeZone";
import { getPreferencesRequest, setPreferenceRequest, setTimeZoneRequest } from "@/services/notificationService";

// One switch with its name and what it does.
function PreferenceRow({ item, busy, onToggle }) {
  const labelId = useId();
  const descId = useId();

  return (
    <li className="flex items-start gap-4 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-[14px]">
          {item.label}
        </p>
        <p id={descId} className="mt-1 text-[13px] leading-relaxed text-fg-2">
          {item.description}
        </p>
      </div>
      <Switch
        checked={item.enabled}
        onChange={(enabled) => onToggle(item.kind, enabled)}
        disabled={busy}
        labelledBy={labelId}
        describedBy={descId}
      />
    </li>
  );
}

// The person's time zone: what reminders use to decide what "today" and "tomorrow" mean.
function TimeZoneCard({ stored, onSaved }) {
  const selectId = useId();
  const browser = browserTimeZone();

  const [options] = useState(() => timeZoneOptions(supportedTimeZones(), stored, browser));
  const [selected, setSelected] = useState(stored || browser || "UTC");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const status = describeZone({ stored, browser });
  const clock = zoneClock(selected, now);

  async function save(zone) {
    if (saving) return;

    setSaving(true);
    setError("");
    setSaved("");

    try {
      const data = await setTimeZoneRequest(zone);
      setSelected(data.timeZone);
      onSaved(data.timeZone);
      setSaved(`Saved: ${zoneLabel(data.timeZone)}.`);
    } catch (err) {
      setError(err.errors?.timeZone || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="zone-heading" className="glass rounded-card p-5 sm:p-6">
      <h2 id="zone-heading" className="font-display text-3xl leading-[1.1]">
        Your time zone
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-fg-2">
        Reminders use this to decide what “today” and “tomorrow” mean for you. {status.message}
      </p>

      <div className="mt-5 space-y-4">
        {error && <FormAlert message={error} />}

        <div>
          <label htmlFor={selectId} className="mb-1.5 block text-[13px] text-fg-2">
            Time zone
          </label>
          <select
            id={selectId}
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setSaved("");
              setError("");
            }}
            disabled={saving}
            className="input"
          >
            {options.map((zone) => (
              <option key={zone} value={zone}>
                {zoneLabel(zone)}
              </option>
            ))}
          </select>
          {clock && (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-fg-2">
              <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
              It’s {clock} there right now.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => save(selected)}
            disabled={saving || selected === stored}
            className="btn-primary inline-flex h-10 items-center rounded-control px-5 text-sm"
          >
            {saving ? "Saving…" : "Save time zone"}
          </button>

          {status.differs && selected !== browser && (
            <button
              type="button"
              onClick={() => save(browser)}
              disabled={saving}
              className="btn-ghost inline-flex h-10 items-center rounded-control px-4 text-sm"
            >
              Use my browser’s ({zoneLabel(browser)})
            </button>
          )}

          <p role="status" aria-live="polite" className="text-[13px] text-success">
            {saved}
          </p>
        </div>
      </div>
    </section>
  );
}

export default function NotificationSettings() {
  const { workspace } = useWorkspace();

  const [state, setState] = useState({ status: "loading", preferences: [], timeZone: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState({});
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    getPreferencesRequest()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", preferences: data.preferences, timeZone: data.timeZone, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", preferences: [], timeZone: null, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setState({ status: "loading", preferences: [], timeZone: null, error: "" });
    setAttempt((n) => n + 1);
  }

  // Instant on screen, then confirmed. If the server says no, the switch goes back.
  async function toggle(kind, enabled) {
    if (busy[kind]) return;

    const label = state.preferences.find((item) => item.kind === kind)?.label ?? "That setting";
    const apply = (value) =>
      setState((current) => ({
        ...current,
        preferences: current.preferences.map((item) => (item.kind === kind ? { ...item, enabled: value } : item)),
      }));

    setProblem("");
    setNotice("");
    setBusy((current) => ({ ...current, [kind]: true }));
    apply(enabled);

    try {
      const data = await setPreferenceRequest(kind, enabled);
      const saved = data.preferences.find((item) => item.kind === kind);
      if (saved) apply(saved.enabled);
      setNotice(`${label} turned ${enabled ? "on" : "off"}.`);
    } catch (error) {
      apply(!enabled);
      setProblem(error.message);
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[kind];
        return next;
      });
    }
  }

  const groups = groupPreferences(state.preferences);

  return (
    <div>
      <PageHeading
        eyebrow="Notifications"
        title="Settings"
        description="Choose what you hear about. These follow you into every workspace."
      />

      <Reveal level="subtle" className="mt-8">
        <NotificationsNav workspaceId={workspace.id} />
      </Reveal>

      <div className="mt-8 max-w-2xl space-y-6">
        {state.status === "loading" && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="skeleton h-48 rounded-card" />
            <div className="skeleton h-48 rounded-card" />
            <span className="sr-only">Loading your settings</span>
          </div>
        )}

        {/* Never show empty settings when the real problem is a failed request. */}
        {state.status === "error" && (
          <div className="max-w-md space-y-4">
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
            {/* Announces each change, politely. */}
            <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-success">
              {notice}
            </p>
            {problem && <FormAlert message={problem} />}

            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`group-${group.key}`} className="glass rounded-card p-5 sm:p-6">
                <h2 id={`group-${group.key}`} className="mb-5 font-display text-3xl leading-[1.1]">
                  {group.label}
                </h2>
                <ul>
                  {group.items.map((item) => (
                    <PreferenceRow key={item.kind} item={item} busy={Boolean(busy[item.kind])} onToggle={toggle} />
                  ))}
                </ul>
              </section>
            ))}

            <p className="text-[13px] leading-relaxed text-fg-muted">
              Turning something off only stops new notifications of that kind. Nothing you already have is removed.
            </p>

            <TimeZoneCard
              stored={state.timeZone}
              onSaved={(timeZone) => setState((current) => ({ ...current, timeZone }))}
            />
          </>
        )}
      </div>
    </div>
  );
}