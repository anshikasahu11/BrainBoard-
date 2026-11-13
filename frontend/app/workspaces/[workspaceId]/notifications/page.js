import NotificationsPage from "@/components/notifications/NotificationsPage";

export const metadata = { title: "Notifications · BrainBoard" };

// The shell (sidebar, loading and not-found screens) comes from the parent layout.js.
export default function Page() {
  return <NotificationsPage />;
}