import { useState, useRef } from "react";

// --- TERMS & CONDITIONS -------------------------------------------------------
const TERMS_TEXT = `WHISPR — TERMS & CONDITIONS

Last updated: 2025
Platform: Whispr
For: Verified students only

By creating an account on Whispr, you agree to the following terms. Please read carefully before proceeding.

1. ELIGIBILITY
   This platform is exclusively for verified students. By signing up, you confirm you are a currently enrolled student. Accounts found to belong to non-students will be permanently banned.

2. ANONYMITY & IDENTITY
   You will be assigned a randomly generated username. Your real identity is not displayed publicly. However, you must not attempt to reveal, guess, or expose other users' real identities. Doxxing of any kind will result in an immediate permanent ban.

3. ALL POSTS ARE MONITORED
   ⚠️ Important: All content posted on this platform is actively monitored by the platform admin. While your username is anonymous to other users, the platform retains records that may be used to identify accounts responsible for violations if escalated to school authorities.

4. POST AT YOUR OWN RISK
   Every post you make is your sole responsibility. Whispr and its administrators are not liable for any content posted by users. If your post violates these terms or school policy, you bear full responsibility for the consequences, which may include referral to school authorities.

5. ACCEPTABLE USE — YOU MUST NOT POST:
   • Hate speech, tribalism, racism, or discrimination of any kind
   • Harassment, bullying, or targeted attacks on any individual
   • Threats of violence or harm
   • Sexual or explicit content
   • Spam or repetitive content
   • Misinformation or false accusations
   • Content that violates your school's student code of conduct

6. NO PERSONAL INFORMATION
   ⚠️ Do not share your own or anyone else's personal information — including full names, phone numbers, hostel/room details, photos, or any identifying details. Violations will be removed immediately and the account suspended.

7. REPORTING
   Use the Report (🚩) button on any post that violates these terms. Do not abuse the report system. False or malicious reports are also a violation.

8. ACCOUNT SUSPENSION & BANS
   Accounts that violate these terms may be temporarily or permanently banned without notice. Attempting to create a new account after a ban is a further violation and will be reported to school authorities.

9. ESCALATION TO SCHOOL AUTHORITIES
   In cases of serious violations — including but not limited to threats, harassment, or cyberbullying — the platform admin reserves the right to escalate the matter to school student affairs or relevant authorities, providing any records necessary for investigation.

10. CONTENT REMOVAL
    The admin may remove any post at any time without explanation. Removed content will not be restored.

11. CHANGES TO TERMS
    These terms may be updated at any time. Continued use of the platform after changes means you accept the updated terms.

12. CONTACT & SUPPORT
    For issues, concerns, or to report a serious violation privately, use the support button (💬) in the app.

By clicking "Accept & Continue" you confirm that:
✓ You are a current student
✓ You have read and understood these terms
✓ You accept that all posts are monitored and you post at your own risk
✓ You will not share personal information of yourself or others`;

export default function TermsModal({ onAccept, onDecline }) {
  const [scrolled, setScrolled] = useState(false);
  const bodyRef = useRef();
  const handleScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolled(true);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <span className="modal-title">📋 Terms & Conditions</span>
        </div>
        <div ref={bodyRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: 24, fontSize: 13, lineHeight: 1.8, color: "var(--muted)", whiteSpace: "pre-wrap", fontFamily: "var(--font-body)" }}>
          {TERMS_TEXT}
        </div>
        {!scrolled && (
          <div style={{ padding: "8px 24px", fontSize: 12, color: "var(--warn)", textAlign: "center", borderTop: "1px solid var(--border)" }}>
            Scroll to the bottom to accept
          </div>
        )}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={onAccept} disabled={!scrolled}>
            Accept & Continue
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={onDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
