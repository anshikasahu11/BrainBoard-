import { z } from "zod";

// Turning one kind of notification on or off.
export const preferenceSchema = z.object({
  enabled: z.boolean({ error: "enabled must be true or false" }),
});