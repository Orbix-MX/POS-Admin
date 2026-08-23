interface InvitationTemplateData {
  tenantName: string;
  acceptUrl: string;
  expiresAt: Date;
}

/** Escapa lo que viene de la base para que no se interprete como HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Correo de invitación a una empresa.
 *
 * Sin imágenes remotas ni scripts: los clientes de correo los bloquean y, en el
 * caso de las imágenes, sirven para saber quién abrió el mensaje.
 */
export function generateInvitationHTML({
  tenantName,
  acceptUrl,
  expiresAt,
}: InvitationTemplateData): string {
  const empresa = escapeHtml(tenantName);
  const caduca = expiresAt.toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2933;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e7eb;">
    <tr>
      <td style="padding:28px 28px 8px;">
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;">Te invitaron a ${empresa}</h1>
        <p style="margin:0;color:#616e7c;font-size:14px;line-height:1.5;">
          Podrás acceder a ${empresa} en Orbix ERP con tu propia cuenta.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <a href="${acceptUrl}"
           style="display:inline-block;padding:12px 22px;background:#1a56db;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          Aceptar invitación
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 20px;">
        <p style="margin:0 0 6px;color:#616e7c;font-size:12px;line-height:1.5;">
          Si el botón no funciona, copia este enlace:
        </p>
        <p style="margin:0;word-break:break-all;font-size:12px;color:#1a56db;">${acceptUrl}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px 24px;border-top:1px solid #e4e7eb;">
        <p style="margin:0 0 6px;color:#616e7c;font-size:12px;line-height:1.5;">
          El enlace caduca el <strong>${caduca}</strong> y solo puede usarse una vez.
        </p>
        <p style="margin:0;color:#9aa5b1;font-size:12px;line-height:1.5;">
          Si no esperabas esta invitación, ignora este mensaje: no se creará ningún
          acceso mientras no la aceptes.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
