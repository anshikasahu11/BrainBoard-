// "Good morning", "Good afternoon" and so on, based on the visitor's own clock.
export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}