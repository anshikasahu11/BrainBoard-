// A self-test for the notification rules (who gets notified, collapsing repeats, paging,
// settings). It needs no servers and no database.
//
// Run it from the backend folder:
//   node scripts/notifications-unit-check.mjs

import {
  DEFAULT_PAGE,
  KINDS,
  KIND_LIST,
  MAX_PAGE,
  RETENTION_DAYS,
  TARGET_TYPES,
} from "../constants/notifications.js";
import {
  cleanNotificationMeta,
  decide,
  isKnownKind,
  pageSize,
  preferenceList,
  throttleCutoff,
} from "../utils/notificationRules.js";

let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `   (${detail})`}`);
  if (!ok) failures += 1;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("Checking the notification rules\n");

// ---------- 1. The kinds ----------
check(
  "These are the kinds, in this order",
  same(KIND_LIST, ["task.assigned", "task.due_soon", "task.overdue", "member.added", "member.role_changed", "member.removed"]),
  KIND_LIST.join(",")
);
check(
  "Every kind has a short label, a description that is a sentence, and the right settings",
  KIND_LIST.every((kind) => {
    const spec = KINDS[kind];
    return (
      spec.label.length > 3 &&
      spec.label.length <= 40 &&
      spec.description.endsWith(".") &&
      Number.isInteger(spec.throttleMs) &&
      spec.throttleMs >= 0 &&
      typeof spec.recipientMustBeMember === "boolean"
    );
  })
);
check("Labels are all different", new Set(KIND_LIST.map((kind) => KINDS[kind].label)).size === KIND_LIST.length);
check(
  "Only a repeated assignment is collapsed, for 10 minutes. Role changes and removals never are",
  KINDS["task.assigned"].throttleMs === 600000 &&
    KINDS["member.added"].throttleMs === 0 &&
    KINDS["member.role_changed"].throttleMs === 0 &&
    KINDS["member.removed"].throttleMs === 0
);
check(
  "Only a removal can be sent to someone who is no longer a member",
  KIND_LIST.filter((kind) => !KINDS[kind].recipientMustBeMember).join(",") === "member.removed"
);
check("The constants are what the plan says", RETENTION_DAYS === 90 && DEFAULT_PAGE === 20 && MAX_PAGE === 100 && same(TARGET_TYPES, ["task", "workspace"]));

// ---------- 2. Known kinds ----------
check("Real kinds are known", KIND_LIST.every(isKnownKind));
check("Made-up kinds are not", !isKnownKind("task.deleted") && !isKnownKind("") && !isKnownKind("task"));
check(
  "Names that exist on every object are never 'kinds'",
  !isKnownKind("constructor") && !isKnownKind("__proto__") && !isKnownKind("toString") && !isKnownKind("hasOwnProperty")
);
check("Things that aren't text are not kinds", !isKnownKind(null) && !isKnownKind(undefined) && !isKnownKind(5) && !isKnownKind({}) && !isKnownKind(["task.assigned"]));

// ---------- 3. Who gets notified ----------
const base = { kind: "task.assigned", recipientId: "u2", actorId: "u1", muted: [] };

check("Someone else's action notifies the person", same(decide(base), { send: true, reason: null }));
check("Your own action never notifies you", same(decide({ ...base, recipientId: "u1" }), { send: false, reason: "self" }));
check("Ids are compared as text, so an id object and its text match", decide({ ...base, recipientId: { toString: () => "u1" } }).reason === "self");
check("A muted kind is not sent", same(decide({ ...base, muted: ["task.assigned"] }), { send: false, reason: "muted" }));
check("Muting one kind doesn't affect another", decide({ ...base, kind: "member.added", muted: ["task.assigned"] }).send === true);
check("A missing mute list is fine", decide({ kind: "member.added", recipientId: "u2", actorId: "u1" }).send === true && decide({ ...base, muted: undefined }).send === true && decide({ ...base, muted: null }).send === true);
check("An unknown kind is not sent", same(decide({ ...base, kind: "robot.dance" }), { send: false, reason: "unknown_kind" }));
check("No recipient is not sent", decide({ ...base, recipientId: null }).reason === "no_recipient" && decide({ ...base, recipientId: "" }).send === false);
check("When the actor isn't known, it still isn't mistaken for 'self'", decide({ ...base, actorId: undefined }).send === true);

// A property test: the rules always hold, whatever the combination.
let seed = 20261113;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];

let allGood = true;
let firstBad = "";
for (let run = 0; run < 500; run += 1) {
  const input = {
    kind: pick([...KIND_LIST, "unknown", "constructor"]),
    recipientId: pick(["u1", "u2", "u3", "", null]),
    actorId: pick(["u1", "u2", "u3"]),
    muted: pick([[], undefined, ["task.assigned"], ["member.added", "member.removed"], KIND_LIST, "not a list"]),
  };
  const out = decide(input);

  const expected =
    isKnownKind(input.kind) &&
    Boolean(input.recipientId) &&
    String(input.recipientId) !== String(input.actorId) &&
    !(Array.isArray(input.muted) && input.muted.includes(input.kind));

  const good = out.send === expected && (out.send ? out.reason === null : typeof out.reason === "string");
  if (!good && allGood) {
    allGood = false;
    firstBad = JSON.stringify(input);
  }
}
check("500 random cases: it sends exactly when every rule allows it", allGood, firstBad);

// ---------- 4. Collapsing repeats ----------
const now = new Date("2026-11-13T12:00:00Z");
check("A repeated assignment counts as a repeat for 10 minutes", throttleCutoff("task.assigned", now).toISOString() === "2026-11-13T11:50:00.000Z");
check("Other kinds never collapse", throttleCutoff("member.added", now) === null && throttleCutoff("member.role_changed", now) === null && throttleCutoff("member.removed", now) === null);
check("An unknown kind never collapses", throttleCutoff("robot.dance", now) === null && throttleCutoff(undefined, now) === null);

// ---------- 5. Page size ----------
check("A normal number is used", pageSize("7") === 7 && pageSize(7) === 7 && pageSize("100") === 100);
check("Too big is capped at 100", pageSize("1000") === 100 && pageSize(999999) === 100);
check("Too small is raised to 1", pageSize("0") === 1 && pageSize("-5") === 1);
check("Something that isn't a number gets the default", pageSize(undefined) === 20 && pageSize("abc") === 20 && pageSize("") === 20 && pageSize(null) === 20);
check("A decimal is cut to a whole number", pageSize("7.9") === 7);

// ---------- 6. The settings list ----------
const everythingOn = preferenceList();
check(
  "With nothing muted, everything is on, in order",
  everythingOn.length === KIND_LIST.length && everythingOn.every((item) => item.enabled === true) && same(everythingOn.map((item) => item.kind), KIND_LIST)
);
check(
  "Each setting has exactly these fields",
  everythingOn.every((item) => same(Object.keys(item).sort(), ["description", "enabled", "kind", "label"]) && item.label === KINDS[item.kind].label)
);
const someOff = preferenceList(["task.assigned", "member.removed"]);
check(
  "A muted kind shows as off and the rest stay on",
  someOff.find((item) => item.kind === "task.assigned").enabled === false &&
    someOff.find((item) => item.kind === "member.removed").enabled === false &&
    someOff.find((item) => item.kind === "member.added").enabled === true &&
    someOff.find((item) => item.kind === "member.role_changed").enabled === true
);
check("Muted things that aren't real kinds are ignored", preferenceList(["robot.dance", "constructor"]).every((item) => item.enabled));
check("A mute list that isn't a list is ignored", preferenceList("nope").every((item) => item.enabled) && preferenceList(null).every((item) => item.enabled));
check("A list of every kind muted turns everything off", preferenceList(KIND_LIST).every((item) => !item.enabled));

// ---------- 7. Small facts ----------
check(
  "Text, numbers, true/false and null are kept",
  same(cleanNotificationMeta({ a: "x", b: 5, c: true, d: null }), { a: "x", b: 5, c: true, d: null })
);
check(
  "Anything else is dropped",
  same(cleanNotificationMeta({ a: {}, b: [1], c: undefined, d: () => 1, e: NaN, f: Infinity, g: "ok" }), { g: "ok" })
);
check("Long text is cut to 120 characters", cleanNotificationMeta({ a: "x".repeat(500) }).a.length === 120);
check("Only the first 8 facts are kept", Object.keys(cleanNotificationMeta(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i])))).length === 8);
check("Nothing in gives nothing out", same(cleanNotificationMeta(null), {}) && same(cleanNotificationMeta(undefined), {}) && same(cleanNotificationMeta({}), {}));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);