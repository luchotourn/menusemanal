import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = "Menu Semanal <notificaciones@menusemanal.app>";

export function sendSignupNotification(email: string, source: string): void {
  if (!resend || !process.env.NOTIFY_EMAIL) {
    console.log("Email notification skipped (RESEND_API_KEY or NOTIFY_EMAIL not set)");
    return;
  }

  const now = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

  resend.emails
    .send({
      from: FROM_ADDRESS,
      to: process.env.NOTIFY_EMAIL,
      subject: `Nuevo registro en waitlist: ${email}`,
      text: [
        `Nuevo registro en la waitlist de Menu Semanal`,
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

export interface ReviewRecipient {
  email: string;
  name: string;
  notificationPreferences: string | null;
}

function recipientWantsEmail(recipient: ReviewRecipient): boolean {
  if (!recipient.notificationPreferences) return true;
  try {
    const prefs = JSON.parse(recipient.notificationPreferences) as {
      email?: boolean;
      mealPlans?: boolean;
    };
    return prefs.email !== false && prefs.mealPlans !== false;
  } catch {
    return true;
  }
}

function formatWeekStartForDisplay(weekStartDate: string): string {
  const [, month, day] = weekStartDate.split("-");
  return `${day}/${month}`;
}

export function sendWeekReviewNotification(params: {
  familyName: string;
  weekStartDate: string;
  submitterName: string;
  recipients: ReviewRecipient[];
}): void {
  if (!resend) {
    console.log("Email notification skipped (RESEND_API_KEY not set)");
    return;
  }

  const optedIn = params.recipients.filter(recipientWantsEmail);
  if (optedIn.length === 0) {
    console.log("No recipients opted in for week review notification");
    return;
  }

  const prettyDate = formatWeekStartForDisplay(params.weekStartDate);
  const subject = `El menú de la semana del ${prettyDate} está listo para revisar`;

  for (const recipient of optedIn) {
    const text = [
      `Hola ${recipient.name},`,
      ``,
      `${params.submitterName} terminó de planear el menú de la semana del ${prettyDate} para la familia ${params.familyName}.`,
      ``,
      `Abrí la app para dejar tus comentarios o proponer cambios en las comidas.`,
      ``,
      `— Menu Semanal`,
    ].join("\n");

    resend.emails
      .send({
        from: FROM_ADDRESS,
        to: recipient.email,
        subject,
        text,
      })
      .then((result) => {
        if (result.error) {
          console.error(`Resend API error for ${recipient.email}:`, JSON.stringify(result.error));
        } else {
          console.log(`Week review notification sent to ${recipient.email}, id: ${result.data?.id}`);
        }
      })
      .catch((err) => console.error(`Failed to send week review notification to ${recipient.email}:`, err));
  }
}
