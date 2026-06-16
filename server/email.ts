import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = "Menu Semanal <notificaciones@menusemanal.app>";
const APP_URL = (process.env.APP_URL || "https://menusemanal.app").replace(/\/$/, "");

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
  const appLink = `${APP_URL}/app`;

  for (const recipient of optedIn) {
    const text = [
      `Hola ${recipient.name},`,
      ``,
      `${params.submitterName} terminó de planear el menú de la semana del ${prettyDate} para la familia ${params.familyName}.`,
      ``,
      `Abrí la app para dejar tus comentarios o proponer cambios en las comidas:`,
      appLink,
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

export function sendReviewSignoffNotification(params: {
  familyName: string;
  weekStartDate: string;
  reviewerName: string;
  verdict: "approved" | "changes_requested";
  note?: string;
  recipient: ReviewRecipient;
}): void {
  if (!resend) {
    console.log("Email notification skipped (RESEND_API_KEY not set)");
    return;
  }

  if (!recipientWantsEmail(params.recipient)) {
    console.log(`Recipient ${params.recipient.email} opted out of signoff notification`);
    return;
  }

  const prettyDate = formatWeekStartForDisplay(params.weekStartDate);
  const verdictLabel = params.verdict === "approved" ? "aprobó" : "pidió cambios en";
  const subject = params.verdict === "approved"
    ? `${params.reviewerName} aprobó el menú de la semana del ${prettyDate}`
    : `${params.reviewerName} pidió cambios en el menú de la semana del ${prettyDate}`;
  const appLink = `${APP_URL}/app`;

  const lines = [
    `Hola ${params.recipient.name},`,
    ``,
    `${params.reviewerName} ${verdictLabel} el menú de la semana del ${prettyDate} (familia ${params.familyName}).`,
  ];

  if (params.note) {
    lines.push(``, `Comentario: ${params.note}`);
  }

  lines.push(
    ``,
    `Abrí la app para ver el detalle:`,
    appLink,
    ``,
    `— Menu Semanal`,
  );

  resend.emails
    .send({
      from: FROM_ADDRESS,
      to: params.recipient.email,
      subject,
      text: lines.join("\n"),
    })
    .then((result) => {
      if (result.error) {
        console.error(`Resend API error for ${params.recipient.email}:`, JSON.stringify(result.error));
      } else {
        console.log(`Review signoff notification sent to ${params.recipient.email}, id: ${result.data?.id}`);
      }
    })
    .catch((err) => console.error(`Failed to send review signoff notification to ${params.recipient.email}:`, err));
}
