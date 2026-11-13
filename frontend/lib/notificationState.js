// Small helpers for the notification list on screen. They never change what they're given:
// each returns a new list. Plain JavaScript with no imports, so it can be tested alone.

// Adds a notification at its place, newest first. If it's already there it's replaced, not
// repeated. Ids grow over time, so sorting by id is sorting by age. Keeps at most `max`.
export function addNotification(items, notification, max = 30) {
  const others = items.filter((item) => item.id !== notification.id);

  return [notification, ...others]
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
    .slice(0, max);
}

export const markItemRead = (items, id, readAt = new Date().toISOString()) =>
  items.map((item) => (item.id === id && !item.read ? { ...item, read: true, readAt } : item));

export const markAllItemsRead = (items, readAt = new Date().toISOString()) =>
  items.map((item) => (item.read ? item : { ...item, read: true, readAt }));

export const removeItem = (items, id) => items.filter((item) => item.id !== id);

export const unreadIn = (items) => items.filter((item) => !item.read).length;

const whole = (count) => {
  const number = Number(count);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

// What the badge shows: nothing for zero, the number up to 99, then "99+".
export function badgeText(count) {
  const number = whole(count);
  if (number === 0) return "";
  return number > 99 ? "99+" : String(number);
}

// What a screen reader says for the bell button.
export function bellLabel(count) {
  const number = whole(count);
  if (number === 0) return "Notifications";
  return `Notifications, ${number > 99 ? "more than 99" : number} unread`;
}