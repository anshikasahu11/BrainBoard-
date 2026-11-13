import { z } from "zod";
import { isValidTimeZone } from "../utils/reminderRules.js";

// Turning one kind of notification on or off.
export const preferenceSchema = z.object({
  enabled: z.boolean({ error: "enabled must be true or false" }),
});

// The person's time zone, like "Asia/Kolkata". Reminders use it to know what "tomorrow" means.
export const timeZoneSchema = z.object({
  timeZone: z
    .string({ error: "Choose a time zone" })
    .trim()
    .refine(isValidTimeZone, { error: "That isn't a time zone we know. Try one like Asia/Kolkata or Europe/London" }),
});