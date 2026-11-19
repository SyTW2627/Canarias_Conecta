/**
 * Proyecto: Canarias Conecta
 * Integrantes: Estela Fernandez Trujillo, Airam Prieto Gonzalez, Sergio Gonzalez Sanchez
 * Funcion: Envia los correos de la aplicacion por SMTP.
 */

import nodemailer, { type Transporter } from 'nodemailer'

type Correo = {
  para: string
  asunto: string
  texto: string
  html: string
}

let transporte: Transporter | null | undefined

// Se crea al primer envio: dotenv ya ha cargado las variables
function obtenerTransporte(): Transporter | null {
  if (transporte !== undefined) return transporte

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST) {
    transporte = null
    return transporte
  }

  const puerto = Number(SMTP_PORT) || 587
  transporte = nodemailer.createTransport({
    host: SMTP_HOST,
    port: puerto,
    // 465 usa TLS desde el inicio; el resto empieza en claro y pasa a TLS con STARTTLS
    secure: puerto === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  })
  return transporte
}

// Sin SMTP configurado, en desarrollo el correo se muestra en la consola para poder probar.
// En produccion eso seria un error de configuracion: se lanza para que quede registrado
export async function enviarCorreo({ para, asunto, texto, html }: Correo): Promise<void> {
  const smtp = obtenerTransporte()

  if (!smtp) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falta la variable SMTP_HOST: no se pueden enviar correos')
    }
    console.log(`\n[correo sin enviar: SMTP no configurado]\nPara: ${para}\nAsunto: ${asunto}\n\n${texto}\n`)
    return
  }

  await smtp.sendMail({
    from: process.env.MAIL_FROM || 'Canarias Conecta <no-responder@canariasconecta.local>',
    to: para,
    subject: asunto,
    text: texto,
    html
  })
}
