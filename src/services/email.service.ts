import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import config from '../config/config';
import logger from '../utils/logger';
import { Listing, ApplicationResult, ListingFromPage } from '../types/listing.types';

interface EmailAttachment {
  filename: string;
  path: string;
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Initializes the email transporter
 */
export function initEmailService(): void {
  try {
    transporter = nodemailer.createTransport({
      host: config.emailHost,
      port: config.emailPort,
      secure: config.emailPort === 465,
      auth: {
        user: config.emailUser,
        pass: config.emailPassword,
      },
    });

    logger.info('Email service initialized');
  } catch (error) {
    logger.error('Failed to initialize email service:', error);
  }
}

/**
 * Verifies the email connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  if (!transporter) {
    initEmailService();
  }

  try {
    await transporter!.verify();
    logger.info('Email connection verified');
    return true;
  } catch (error) {
    logger.error('Email connection verification failed:', error);
    return false;
  }
}

/**
 * Sends an email notification
 */
async function sendEmail(
  subject: string,
  htmlContent: string,
  attachments: EmailAttachment[] = []
): Promise<boolean> {
  if (!transporter) {
    initEmailService();
  }

  try {
    const mailOptions = {
      from: config.emailUser,
      to: config.emailTo,
      subject: `[ImmoBot] ${subject}`,
      html: htmlContent,
      attachments,
    };

    await transporter!.sendMail(mailOptions);
    logger.info(`Email sent: ${subject}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email: ${subject}`, error);
    return false;
  }
}

/**
 * Sends notification for a new listing
 */
export async function sendNewListingNotification(
  listing: ListingFromPage,
  pdfPath?: string
): Promise<boolean> {
  const subject = `Neue Wohnung: ${listing.address || listing.title}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ff7300;">🏠 Neue Wohnung gefunden!</h2>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">${listing.title}</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Adresse:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${listing.address}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Preis:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${listing.price}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Größe:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${listing.size || '-'}</td>
          </tr>
          ${listing.rooms ? `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Zimmer:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${listing.rooms}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0;"><strong>ID:</strong></td>
            <td style="padding: 8px 0;">${listing.id}</td>
          </tr>
        </table>
      </div>
      
      <p>
        <a href="${listing.url}" style="display: inline-block; background: #ff7300; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          Zum Inserat →
        </a>
      </p>
      
      <p style="color: #666; font-size: 12px;">
        Gefunden am: ${new Date().toLocaleString('de-DE')}
      </p>
    </div>
  `;

  const attachments: EmailAttachment[] = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({
      filename: path.basename(pdfPath),
      path: pdfPath,
    });
  }

  return await sendEmail(subject, htmlContent, attachments);
}

/**
 * Sends notification for a successful application
 */
export async function sendApplicationSuccessNotification(
  listing: ListingFromPage,
  result: ApplicationResult
): Promise<boolean> {
  const subject = `✅ Bewerbung gesendet: ${listing.address || listing.title}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">✅ Bewerbung erfolgreich gesendet!</h2>
      
      <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <h3 style="margin-top: 0; color: #333;">${listing.title}</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;"><strong>Adresse:</strong></td>
            <td style="padding: 8px 0;">${listing.address}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Preis:</strong></td>
            <td style="padding: 8px 0;">${listing.price}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Größe:</strong></td>
            <td style="padding: 8px 0;">${listing.size || '-'}</td>
          </tr>
        </table>
      </div>
      
      <p>
        <a href="${listing.url}" style="display: inline-block; background: #ff7300; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          Zum Inserat →
        </a>
      </p>
      
      ${result.pdfPath ? '<p style="color: #666;">📎 PDF des Inserats im Anhang</p>' : ''}
      
      <p style="color: #666; font-size: 12px;">
        Beworben am: ${new Date().toLocaleString('de-DE')}
      </p>
    </div>
  `;

  const attachments: EmailAttachment[] = [];
  if (result.pdfPath && fs.existsSync(result.pdfPath)) {
    attachments.push({
      filename: path.basename(result.pdfPath),
      path: result.pdfPath,
    });
  }

  return await sendEmail(subject, htmlContent, attachments);
}

/**
 * Sends notification for a failed application
 */
export async function sendApplicationErrorNotification(
  listing: ListingFromPage,
  result: ApplicationResult
): Promise<boolean> {
  const subject = `❌ Bewerbung fehlgeschlagen: ${listing.address || listing.title}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">❌ Bewerbung fehlgeschlagen</h2>
      
      <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
        <h3 style="margin-top: 0; color: #333;">${listing.title}</h3>
        
        <p><strong>Fehler:</strong> ${result.errorMessage || 'Unbekannter Fehler'}</p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;"><strong>Adresse:</strong></td>
            <td style="padding: 8px 0;">${listing.address}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Preis:</strong></td>
            <td style="padding: 8px 0;">${listing.price}</td>
          </tr>
        </table>
      </div>
      
      <p>
        <a href="${listing.url}" style="display: inline-block; background: #ff7300; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          Manuell bewerben →
        </a>
      </p>
      
      <p style="color: #666; font-size: 12px;">
        Versuch am: ${new Date().toLocaleString('de-DE')}
      </p>
    </div>
  `;

  return await sendEmail(subject, htmlContent);
}

/**
 * Sends a summary notification
 */
export async function sendSummaryNotification(
  totalChecked: number,
  newListings: number,
  successfulApplications: number,
  failedApplications: number
): Promise<boolean> {
  const subject = `📊 Tägliche Zusammenfassung`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">📊 ImmoBot Zusammenfassung</h2>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #ddd;"><strong>Geprüfte Angebote:</strong></td>
            <td style="padding: 12px 0; border-bottom: 1px solid #ddd; text-align: right;">${totalChecked}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #ddd;"><strong>Neue Angebote:</strong></td>
            <td style="padding: 12px 0; border-bottom: 1px solid #ddd; text-align: right; color: #ff7300;">${newListings}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #ddd;"><strong>Erfolgreiche Bewerbungen:</strong></td>
            <td style="padding: 12px 0; border-bottom: 1px solid #ddd; text-align: right; color: #28a745;">${successfulApplications}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0;"><strong>Fehlgeschlagene Bewerbungen:</strong></td>
            <td style="padding: 12px 0; text-align: right; color: #dc3545;">${failedApplications}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #666; font-size: 12px;">
        Erstellt am: ${new Date().toLocaleString('de-DE')}
      </p>
    </div>
  `;

  return await sendEmail(subject, htmlContent);
}

/**
 * Sends an error notification
 */
export async function sendErrorNotification(
  error: string,
  details?: string
): Promise<boolean> {
  const subject = `⚠️ Fehler aufgetreten`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">⚠️ Bot-Fehler</h2>
      
      <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
        <p><strong>Fehler:</strong> ${error}</p>
        ${details ? `<p><strong>Details:</strong></p><pre style="background: #fff; padding: 10px; overflow-x: auto;">${details}</pre>` : ''}
      </div>
      
      <p style="color: #666; font-size: 12px;">
        Aufgetreten am: ${new Date().toLocaleString('de-DE')}
      </p>
    </div>
  `;

  return await sendEmail(subject, htmlContent);
}

/**
 * Sends a startup notification
 */
export async function sendStartupNotification(): Promise<boolean> {
  const subject = `🚀 Bot gestartet`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">🚀 ImmoBot gestartet</h2>
      
      <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p>Der ImmoBot wurde erfolgreich gestartet und überwacht jetzt Ihre Suche.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px 0;"><strong>Check-Intervall:</strong></td>
            <td style="padding: 8px 0;">${config.baseIntervalMinutes} Minuten (±${config.randomOffsetPercent}%)</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Nachtmodus:</strong></td>
            <td style="padding: 8px 0;">${config.nightModeEnabled ? `Aktiv (${config.nightStartHour}:00 - ${config.nightEndHour}:00)` : 'Deaktiviert'}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #666; font-size: 12px;">
        Gestartet am: ${new Date().toLocaleString('de-DE')}
      </p>
    </div>
  `;

  return await sendEmail(subject, htmlContent);
}

export default {
  initEmailService,
  verifyEmailConnection,
  sendNewListingNotification,
  sendApplicationSuccessNotification,
  sendApplicationErrorNotification,
  sendSummaryNotification,
  sendErrorNotification,
  sendStartupNotification,
};
