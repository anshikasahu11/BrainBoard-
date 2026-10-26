import Link from "next/link";
import { Trash2 } from "lucide-react";
import EditingNow from "@/components/documents/EditingNow";
import { formatRelative } from "@/lib/format";

// One document in the list. onDelete is passed only when the viewer may delete it.
// editors: the other people who have this document open right now.
export default function DocumentRow({ doc, href, onDelete, editors = [] }) {
  return (
    <li className="doc-row">
      <Link href={href} className="doc-link">
        <span className="block truncate text-[15px] font-medium">{doc.title}</span>

        {doc.excerpt ? (
          <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-fg-2">
            {doc.excerpt}
          </span>
        ) : (
          <span className="mt-1 block text-[13px] italic text-fg-muted">No content yet</span>
        )}

        <span className="mt-2.5 block truncate font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
          Edited {formatRelative(doc.updatedAt)} · {doc.lastEditedBy.name}
        </span>

        {editors.length > 0 && (
          <span className="mt-2 block">
            <EditingNow people={editors} />
          </span>
        )}
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(doc)}
          aria-label={`Delete ${doc.title}`}
          className="mr-3 mt-3 grid size-9 shrink-0 place-items-center self-start rounded-control text-fg-muted transition-colors hover:bg-white/10 hover:text-danger"
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      )}
    </li>
  );
}