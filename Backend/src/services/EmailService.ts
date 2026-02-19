import { Resend } from "resend";

// --- Branding (alineado con la app Tercer Tiempo)
const PRIMARY_COLOR = "#2648D1";
const LOGO_URL =
  "https://res.cloudinary.com/doe1cks3v/image/upload/v1771403470/Logo_mxhtvi.png";
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Leer env aquí haría que RESEND_API_KEY sea undefined: EmailService se importa
// antes de que server.ts ejecute dotenv.config(). Por eso leemos la key al enviar.
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      "[EmailService] RESEND_API_KEY no está definido. Los emails no se enviarán.",
    );
    return null;
  }
  return new Resend(key);
}

// --- Template: Email de Verificación (HTML)
function getVerificationEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu email - Tercer Tiempo</title>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family:${FONT_STACK}; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="40%" cellspacing="0" cellpadding="0" style="width:40%; max-width:520px; min-width:320px; margin:0 auto;">
          <!-- Header con logo -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <img src="${LOGO_URL}" alt="Tercer Tiempo" width="140" height="auto" style="display:block; max-width:140px; height:auto;" />
            </td>
          </tr>
          <!-- Card contenedor -->
          <tr>
            <td style="background-color:#FFFFFF; border-radius:14px; padding:24px 22px; border:1px solid #E2E8F0;">
              <h1 style="margin:0 0 8px 0; font-size:20px; font-weight:800; color:#0F172A; text-align:center;">
                ¡Bienvenido al Tercer Tiempo!
              </h1>
              <p style="margin:0 0 18px 0; font-size:14px; color:#334155; text-align:center; line-height:1.55;">
                Para activar tu cuenta, introduce el siguiente código en la app.
              </p>
              <!-- Código tipo marcador de estadio -->
              <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:0 auto; border-collapse:separate;">
                <tr>
                  <td align="center" style="background-color:#EFF6FF; color:${PRIMARY_COLOR}; font-size:26px; font-weight:900; letter-spacing:8px; padding:14px 22px; border-radius:12px; border:1px solid #BFDBFE;">
                    ${code}
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0 0; font-size:12px; color:#475569; text-align:center; line-height:1.5;">
                Si no creaste una cuenta en Tercer Tiempo, puedes ignorar este correo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#64748B;">
                Tercer Tiempo — Tu liga, tu momento.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

// --- Template: Email de Restablecer Contraseña (HTML)
function getPasswordResetEmailHtml(token: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablece tu contraseña - Tercer Tiempo</title>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family:${FONT_STACK}; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="40%" cellspacing="0" cellpadding="0" style="width:40%; max-width:520px; min-width:320px; margin:0 auto;">
          <!-- Header con logo -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <img src="${LOGO_URL}" alt="Tercer Tiempo" width="140" height="auto" style="display:block; max-width:140px; height:auto;" />
            </td>
          </tr>
          <!-- Card contenedor -->
          <tr>
            <td style="background-color:#FFFFFF; border-radius:14px; padding:24px 22px; border:1px solid #E2E8F0;">
              <h1 style="margin:0 0 8px 0; font-size:20px; font-weight:800; color:#0F172A; text-align:center;">
                Restablecer contraseña
              </h1>
              <p style="margin:0 0 18px 0; font-size:14px; color:#334155; text-align:center; line-height:1.55;">
                Recibimos una solicitud para cambiar la contraseña de tu cuenta. Usa el siguiente código para completar el proceso en la app.
              </p>
              <!-- Código (sin link) -->
              <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:0 auto; border-collapse:separate;">
                <tr>
                  <td align="center" style="background-color:#EFF6FF; color:${PRIMARY_COLOR}; font-size:26px; font-weight:900; letter-spacing:8px; padding:14px 22px; border-radius:12px; border:1px solid #BFDBFE;">
                    ${token}
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0 0; font-size:12px; color:#475569; text-align:center; line-height:1.5;">
                Si no solicitaste este cambio, ignora este correo. Tu contraseña no se modificará.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px; text-align:center;">
              <p style="margin:0; font-size:12px; color:#64748B;">
                Tercer Tiempo — Tu liga, tu momento.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

// Resend: sin dominio verificado solo permite enviar AL email del dueño de la cuenta.
// Para enviar a cualquier usuario: verificar dominio en resend.com/domains y poner
// EMAIL_FROM=no-reply@tudominio.com (sin EMAIL_FROM se usa onboarding@resend.dev).
export async function sendVerificationEmail(email: string, code: string) {
  const resend = getResend();
  if (!resend) return;
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const html = getVerificationEmailHtml(code);
  const text = `Tu código de verificación es: ${code}`;
  try {
    const result = await resend.emails.send({
      from,
      to: email,
      subject: "Verifica tu email - Tercer Tiempo",
      html,
      text,
    });
    const res = result as unknown as {
      data?: { id: string };
      error?: { message: string };
    };
    const id = res?.data?.id;
    const err = res?.error;
    if (err) {
      console.error("[EmailService] Verificación rechazada:", err.message);
    }
  } catch (err) {
    console.error("[EmailService] Error enviando verificación:", err);
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resend = getResend();
  if (!resend) return;

  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const html = getPasswordResetEmailHtml(token);
  const text = `Tu código para restablecer tu contraseña es: ${token}\n\nSi no solicitaste este cambio, ignora este correo.`;

  try {
    const result = await resend.emails.send({
      from,
      to: email,
      subject: "Código para restablecer tu contraseña - Tercer Tiempo",
      html,
      text,
    });
    const res = result as unknown as {
      data?: { id: string };
      error?: { message: string };
    };
    const id = res?.data?.id;
    const err = res?.error;
    if (err) {
      console.error("[EmailService] Reset rechazado:", err.message);
    }
  } catch (err) {
    console.error("[EmailService] Error enviando reset password:", err);
  }
}
