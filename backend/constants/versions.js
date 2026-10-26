// How long to wait between automatic versions of one document while it's being edited.
export const AUTO_INTERVAL_MS = 10 * 60 * 1000;

// The most versions kept per document. Past this, the oldest AUTOMATIC ones go first;
// named versions and "before restoring" backups are never removed this way.
export const MAX_VERSIONS = 50;

export const MAX_LABEL_LENGTH = 80;

// auto:            kept automatically, before a save replaced the text
// manual:          saved on purpose by someone ("Release candidate")
// restore-backup:  the text that was replaced when an older version was restored
export const KINDS = ["auto", "manual", "restore-backup"];