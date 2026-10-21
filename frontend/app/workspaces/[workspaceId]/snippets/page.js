
import SnippetsPanel from "@/components/snippets/SnippetsPanel";

export const metadata = { title: "Snippets · BrainBoard" };

// The shell (sidebar, loading and not-found screens) comes from the workspace layout.js.
export default function SnippetsPage() {
  return <SnippetsPanel />;
}