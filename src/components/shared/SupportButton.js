import { useState, useRef, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

export default function SupportButton({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const submit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    await addDoc(collection(db, "support"), {
      uid: currentUser.uid,
      username: currentUser.username,
      subject: subject.trim() || "General",
      message: message.trim(),
      status: "open",
      createdAt: serverTimestamp(),
    });
    setSent(true); setLoading(false);
    setTimeout(() => { setSent(false); setSubject(""); setMessage(""); setOpen(false); }, 2500);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="notif-btn" onClick={() => setOpen(o => !o)} title="Contact Support">💬</button>
      {open && (
        <div className="notif-panel fade-in" style={{ width: 320, padding: 0 }}>
          <div className="notif-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Contact Admin</span>
            <button className="close-btn" onClick={() => setOpen(false)}>x</button>
          </div>
          {sent ? (
            <div style={{ padding: 20 }}><div className="alert alert-success" style={{ margin: 0 }}>Message sent! We will get back to you soon.</div></div>
          ) : (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Report a bug, ask for help, or send us feedback.</div>
              <div style={{ marginBottom: 10 }}>
                <select className="category-select" style={{ width: "100%" }} value={subject} onChange={e => setSubject(e.target.value)}>
                  <option value="">Select topic...</option>
                  <option value="Bug Report">Bug Report</option>
                  <option value="Account Issue">Account Issue</option>
                  <option value="Content Report">Content Report</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <textarea
                className="compose-area"
                placeholder="Describe your issue or message..."
                value={message} onChange={e => setMessage(e.target.value)}
                style={{ minHeight: 100, marginBottom: 10, fontSize: 13 }}
              />
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={submit} disabled={loading || !message.trim()}>
                {loading ? "Sending..." : "Send Message"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
