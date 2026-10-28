import { Bookmark, Clock, RotateCcw } from "lucide-react";

// The three kinds of version. Each has an icon and a word, so colour is never the only signal.
//   auto:            kept automatically, before a save replaced the text
//   manual:          saved on purpose by someone
//   restore-backup:  the text that was replaced when an older version was restored
export const KINDS = {
  auto: { label: "Automatic", icon: Clock, classes: "bg-white/10 text-fg-2" },
  manual: { label: "Saved", icon: Bookmark, classes: "bg-ember-500/15 text-ember-300" },
  "restore-backup": {
    label: "Before restore",
    icon: RotateCcw,
    classes: "bg-petrol-600/25 text-petrol-300",
  },
};

export const kindInfo = (kind) => KINDS[kind] ?? KINDS.auto;