import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function sendSignupNotification(email: string, source: string): void {
  if (!resend || !process.env.NOTIFY_EMAIL) {
    console.log("Email notification skipped (RESEND_API_KEY or NOTIFY_EMAIL not set)");
    return;
  }

  const now = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

  resend.emails
    .send({
      from: "Menu Familiar <notificaciones@menusemanal.app>",
      to: process.env.NOTIFY_EMAIL,
      subject: `Nuevo registro en waitlist: ${email}`,
      text: [
        `Nuevo registro en la waitlist de Menu Familiar`,
        ``,
        `Email: ${email}`,
        `Fuente: ${source}`,
        `Fecha: ${now}`,
      ].join("\n"),
    })
    .then((result) => {
      if (result.error) {
        console.error("Resend API error:", JSON.stringify(result.error));
      } else {
        console.log(`Signup notification sent for ${email}, id: ${result.data?.id}`);
      }
    })
    .catch((err) => console.error("Failed to send signup notification:", err));
}
