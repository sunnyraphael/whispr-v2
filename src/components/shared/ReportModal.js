import { useState } from "react";
import { auth } from "../../firebase";

export default function ReportModal({ type, targetId, targetUid, reporterUid, onClose }) {
  const reasons = ["Hate speech", "Harassment", "Spam", "Misinformation", "Illegal content", "Other"];
  const [reason, setReason] = useState(""); const [submitted, setSubmitted] = useState(false);
  const submit = async () => {
    if (!reason) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("https://whispr-v2-backend.onrender.com/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          targetId,
          targetUid: targetUid || null,
          reason,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || "Failed to submit report.");
        return;
      }
    } catch (e) {
      alert("Failed to submit report. Please check your connection.");
      return;
    }
    setSubmitted(true); setTimeout(onClose, 1500);
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in" style={{ marginTop: 60 }}>
        <div className="modal-header"><span className="modal-title">Report {type}</span><button className="close-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {submitted ? <div className="alert alert-success">✅ Report submitted. Our team will review it.</div> : (
            <>
              <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>Why are you reporting this {type}?</p>
              <div className="report-options">{reasons.map(r => <label key={r} className="report-option"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /><span style={{ fontSize: 14 }}>{r}</span></label>)}</div>
              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <button className="btn btn-primary" onClick={submit} disabled={!reason}>Submit Report</button>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
