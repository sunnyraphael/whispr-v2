export default function Avatar({ username }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : "?";
  const hue = username ? username.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 200;
  return <div className="avatar" style={{ background: `linear-gradient(135deg, hsl(${hue},70%,50%), hsl(${(hue + 60) % 360},70%,60%))` }}>{initials}</div>;
}
