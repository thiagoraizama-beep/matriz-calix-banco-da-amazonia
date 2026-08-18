import { Resend } from "resend";

let resendClient = null;

function getResend() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Remetente de teste do Resend: funciona sem verificar dominio proprio, mas so
// entrega para o e-mail cadastrado na conta Resend. Trocar por um remetente
// verificado (ex: nao-responda@agenciacalix.com.br) apos configurar o dominio
// em resend.com/domains.
const FROM = process.env.RESEND_FROM || "onboarding@resend.dev";

// Envia o e-mail de recuperacao de senha com o link proprio do dashboard
// (token gerado por authService.js), sem depender do Supabase Auth — evita o
// problema de links de uso unico sendo consumidos por scanners de seguranca
// de e-mail corporativo, e do rate limit do fluxo de Auth do Supabase.
export async function sendPasswordResetEmail(destinatario, link) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM,
    to: destinatario,
    subject: "Recuperação de senha - Dashboard Senado Federal",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #14213d;">Recuperação de senha</h2>
        <p style="color: #333;">Recebemos uma solicitação para redefinir sua senha no Dashboard Senado Federal.</p>
        <p style="color: #333;">Clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora e só pode ser usado uma vez.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #2f6feb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Redefinir senha
          </a>
        </p>
        <p style="color: #888; font-size: 13px;">Se você não solicitou essa recuperação, pode ignorar este e-mail com segurança.</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message || "Falha ao enviar e-mail de recuperação");
}
