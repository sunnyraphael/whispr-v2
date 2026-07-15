import { Icon } from "../shared/Icons";

export default function PushToast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "14px 20px", zIndex: 9999,
      boxShadow: "var(--shadow)", minWidth: 260, maxWidth: "90vw",
      display: "flex", gap: 12, alignItems: "flex-start",
      animation: "fadeIn 0.3s ease",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: "rgba(232,115,74,0.12)", color: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon.Bell size={16} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{toast.title}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{toast.body}</div>
      </div>
    </div>
  );
}
