import mongoose from "mongoose";
import "../config/env.js";
import { runReminders } from "./reminderService.js";

// Runs the reminder job on a timer. This file starts itself once the database is connected, but
// only when something IMPORTS it (the server does; scripts and tests never do).
// To turn it off, put REMINDERS_ENABLED=false in backend/.env.

const EVERY_MS = 15 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 30 * 1000;

let started = false;
let running = false;

async function tick() {
  // Never two runs at once. If one is slow, the next tick is skipped.
  if (running) return;
  running = true;

  try {
    const result = await runReminders();
    if (result.created > 0 || result.deferred > 0) {
      console.log(
        `Reminders: sent ${result.created}${result.deferred > 0 ? `, ${result.deferred} more waiting for the next run` : ""}`
      );
    }
  } catch (error) {
    console.error("Reminder tick failed:", error.message);
  } finally {
    running = false;
  }
}

export function startReminderScheduler() {
  if (started) return;

  const setting = String(process.env.REMINDERS_ENABLED ?? "true").trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(setting)) {
    console.log("Reminders: turned off (REMINDERS_ENABLED)");
    return;
  }

  started = true;

  // unref() means these timers never keep the process alive on their own.
  setTimeout(tick, FIRST_RUN_DELAY_MS).unref();
  setInterval(tick, EVERY_MS).unref();
  console.log("Reminders: checking every 15 minutes");
}

// Start as soon as the database is ready.
if (mongoose.connection.readyState === 1) startReminderScheduler();
else mongoose.connection.once("open", startReminderScheduler);