// A person's initial in a circle, with a green dot while they're online.
//   label: when given, the whole thing is announced as that text ("Rahul, online").
//          Without it, the avatar is decorative and only the dot says "Online".
export default function PresenceAvatar({ name, online = false, label, small = false }) {
  const letter = name.charAt(0).toUpperCase();

  return (
    <span
      className="presence-avatar"
      title={label ? name : undefined}
      {...(label ? { role: "img", "aria-label": label } : {})}
    >
      <span className={`avatar ${small ? "avatar-sm" : ""}`} aria-hidden="true">
        {letter}
      </span>
      {online &&
        (label ? (
          <span className="presence-dot" aria-hidden="true" />
        ) : (
          <span className="presence-dot" role="img" aria-label="Online" />
        ))}
    </span>
  );
}