import { Crown, Shield, User } from "lucide-react";

// Icon plus word, so the role never depends on color alone.
const ROLE_STYLES = {
  owner: { label: "Owner", icon: Crown, classes: "bg-ember-500/15 text-ember-300" },
  admin: { label: "Admin", icon: Shield, classes: "bg-petrol-600/25 text-petrol-300" },
  member: { label: "Member", icon: User, classes: "bg-white/10 text-fg-2" },
};

export default function RoleBadge({ role }) {
  const style = ROLE_STYLES[role] ?? ROLE_STYLES.member;
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-[11px] ${style.classes}`}
    >
      <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
      {style.label}
    </span>
  );
}