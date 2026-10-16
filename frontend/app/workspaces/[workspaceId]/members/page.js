
import MembersPanel from "@/components/members/MembersPanel";

export const metadata = { title: "Members · BrainBoard" };

// The shell (sidebar, loading and not-found screens) comes from the parent layout.js.
export default function MembersPage() {
  return <MembersPanel />;
}