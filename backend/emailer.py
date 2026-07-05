"""Transactional email via Resend. All sends are best-effort no-ops when
RESEND_API_KEY is not configured, so the app keeps working without email."""
import os
import logging

import resend

logger = logging.getLogger("uterun.email")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
# e.g. "UteRun <no-reply@yourdomain.com>"
RESEND_FROM = os.environ.get("RESEND_FROM", "UteRun <onboarding@resend.dev>")

email_enabled = bool(RESEND_API_KEY)
if email_enabled:
    resend.api_key = RESEND_API_KEY
    logger.info("Resend email configured")

BRAND = "#E8722B"
CHARCOAL = "#1C1C1E"


def _shell(title: str, body_html: str) -> str:
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FAF8F5;font-family:Arial,Helvetica,sans-serif;color:{CHARCOAL}">
    <div style="max-width:520px;margin:0 auto;padding:24px">
      <div style="background:{CHARCOAL};border-radius:16px;padding:20px 24px;text-align:center">
        <span style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:0.5px">Ute<span style="color:{BRAND}">Run</span></span>
        <div style="color:#bdbdbd;font-size:12px;margin-top:2px">Townsville</div>
      </div>
      <div style="background:#fff;border-radius:16px;padding:28px 24px;margin-top:16px;border:1px solid #ECE7E1">
        <h1 style="font-size:20px;margin:0 0 12px">{title}</h1>
        {body_html}
      </div>
      <p style="color:#9b9b9b;font-size:12px;text-align:center;margin-top:18px">
        UteRun Townsville · Same-day pickups, deliveries &amp; moves
      </p>
    </div>
  </body>
</html>"""


def _send(to: str, subject: str, html: str) -> None:
    if not email_enabled or not to:
        return
    try:
        resend.Emails.send({
            "from": RESEND_FROM,
            "to": [to],
            "subject": subject,
            "html": html,
        })
    except Exception as e:  # never break a request because of email
        logger.warning(f"Resend send failed ({subject}): {e}")


def send_welcome(to: str, name: str, role: str) -> None:
    role_line = (
        "Post a job and a trusted local ute owner will be on the way."
        if role == "customer"
        else "Finish your driver setup, go online, and start earning."
    )
    html = _shell(
        f"G'day {name or 'there'}! 👋",
        f"""<p style="font-size:15px;line-height:1.6">Welcome to UteRun Townsville — your account is ready.</p>
        <p style="font-size:15px;line-height:1.6">{role_line}</p>
        <p style="font-size:13px;color:#777;margin-top:18px">Cheers,<br/>The UteRun team</p>""",
    )
    _send(to, "Welcome to UteRun Townsville 🛻", html)


def send_job_receipt(to: str, name: str, job_label: str, amount: float, job_id: str) -> None:
    html = _shell(
        "Payment received ✅",
        f"""<p style="font-size:15px;line-height:1.6">Hi {name or 'there'}, thanks for using UteRun.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#777">Job</td><td style="padding:8px 0;text-align:right">{job_label}</td></tr>
          <tr><td style="padding:8px 0;color:#777">Reference</td><td style="padding:8px 0;text-align:right">#{job_id[:8]}</td></tr>
          <tr><td style="padding:8px 0;color:#777;border-top:1px solid #ECE7E1">Amount paid</td>
              <td style="padding:8px 0;text-align:right;border-top:1px solid #ECE7E1;font-weight:bold">${amount:.2f} AUD</td></tr>
        </table>
        <p style="font-size:13px;color:#777">Paid securely by card via Stripe.</p>""",
    )
    _send(to, f"Your UteRun receipt — ${amount:.2f}", html)


def send_payout_note(to: str, name: str, amount: float, job_label: str) -> None:
    html = _shell(
        "You've earned a run 💰",
        f"""<p style="font-size:15px;line-height:1.6">Nice work {name or 'driver'}! You completed a {job_label}.</p>
        <p style="font-size:28px;font-weight:bold;color:{BRAND};margin:12px 0">${amount:.2f} AUD</p>
        <p style="font-size:14px;line-height:1.6">This has been added to your balance and will be paid out to your
        bank in your next <b>weekly payout</b> via Stripe.</p>
        <p style="font-size:13px;color:#777;margin-top:18px">Keep on truckin',<br/>The UteRun team</p>""",
    )
    _send(to, f"You earned ${amount:.2f} on UteRun", html)


def send_driver_status(to: str, name: str, approved: bool, note: str = "") -> None:
    if approved:
        title = "You're verified! 🎉"
        body = f"""<p style="font-size:15px;line-height:1.6">Great news {name or 'driver'} — your UteRun driver account has been
        <b>approved</b>. You can now go online and start accepting jobs.</p>"""
        subject = "Your UteRun driver account is approved"
    else:
        title = "Verification update"
        body = f"""<p style="font-size:15px;line-height:1.6">Hi {name or 'there'}, we couldn't approve your driver
        application yet.</p>{f'<p style="font-size:14px;color:#777">Reason: {note}</p>' if note else ''}
        <p style="font-size:14px;line-height:1.6">Please review your details and resubmit.</p>"""
        subject = "Your UteRun driver application"
    _send(to, subject, _shell(title, body))


def send_payouts_enabled(to: str, name: str) -> None:
    html = _shell(
        "Payouts are switched on 💸",
        f"""<p style="font-size:15px;line-height:1.6">Good news {name or 'driver'} — your Stripe payout details are verified
        and <b>payouts are now enabled</b>.</p>
        <p style="font-size:14px;line-height:1.6">Your earnings will be paid straight to your bank in your next
        weekly payout. Nothing more to do — just keep accepting jobs!</p>
        <p style="font-size:13px;color:#777;margin-top:18px">Cheers,<br/>The UteRun team</p>""",
    )
    _send(to, "Your UteRun payouts are enabled", html)
