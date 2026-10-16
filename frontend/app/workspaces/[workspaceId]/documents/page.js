
import DocumentsPanel from "@/components/documents/DocumentsPanel";

export const metadata = { title: "Documents · BrainBoard" };

// The shell (sidebar, loading and not-found screens) comes from the workspace layout.js.
export default function DocumentsPage() {
  return <DocumentsPanel />;
}