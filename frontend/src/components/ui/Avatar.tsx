interface AvatarProps {
  name: string;
  size?: number;
}

/**
 * Initial-based avatar (no photo storage exists anywhere in the backend --
 * PublicUser has no avatarUrl field -- so this deliberately doesn't try to
 * render a photo). Used in the navbar, Profile dashboard, and owner cards.
 */
export function Avatar({ name, size = 36 }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="avatar-v2"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
