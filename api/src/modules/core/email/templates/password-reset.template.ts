interface PasswordResetTemplateData {
  resetUrl: string;
  expiresAt: Date;
}

/**
 * Correo de reseteo de contraseña.
 *
 * Sin imágenes remotas ni scripts, igual que el de invitación: los clientes de
 * correo suelen bloquearlas, y en el caso de imágenes sirven para rastrear
 * apertura.
 */
export function generatePasswordResetHTML({
  resetUrl,
  expiresAt,
}: PasswordResetTemplateData): string {
  const caduca = expiresAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2933;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e7eb;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;">Restablece tu contraseña</h1>
        <p style="margin:0;color:#616e7c;font-size:14px;line-height:1.5;">
          Pediste restablecer tu contraseña de Orbix ERP. Si no fuiste tú, ignora este
          correo: tu contraseña actual sigue funcionando.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 22px;background:#1a56db;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          Restablecer contraseña
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 20px;">
        <p style="margin:0 0 6px;color:#616e7c;font-size:12px;line-height:1.5;">
          Si el botón no funciona, copia este enlace:
        </p>
        <p style="margin:0;word-break:break-all;font-size:12px;color:#1a56db;">${resetUrl}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px 24px;border-top:1px solid #e4e7eb;">
        <p style="margin:0;color:#616e7c;font-size:12px;line-height:1.5;">
          El enlace caduca a las <strong>${caduca}</strong> (una hora desde que lo pediste)
          y solo puede usarse una vez.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
