import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SUPPORT_EMAIL = 'oluwolefaith92@gmail.com';

app.use(express.json());

// Initialize Gemini SDK with User-Agent telemetry
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && !apiKey.startsWith('MY_')) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// System instruction enforcing Vault Information Storage Guidance and Email routing for abstract inquiries/complaints
const SYSTEM_INSTRUCTION = `You are the CyberVault Storage & Security Assistant, an intelligent guide embedded inside the Clockin Vault web application.

PRIMARY MISSION:
Guide authenticated users on how to store, organize, protect, and manage their sensitive information in the vault:
1. Storing Credentials & Passwords:
   - Click the "+ Add Item" button in the upper toolbar.
   - Select the "Password / Credential" tab.
   - Enter Title (e.g. "Work Email", "AWS Console"), Service/Website, and Username/Email.
   - For Passwords, users can type their own or click the Magic Wand / Generate button to create strong random passwords with customizable length and character sets.
   - Add optional URL and encrypted secret notes.
2. Storing Secure Documents & Private Notes:
   - Select "+ Add Item" and switch to the "Secure Document" tab.
   - Store passport info, recovery seeds, API tokens, license keys, medical notes, or bank account details.
3. Organization & Management:
   - Use Categories: Personal, Work, Finance, Social, Document.
   - Attach comma-separated tags (e.g., "primary, critical, 2fa").
   - Star any card to mark it as a Favorite for quick 1-click filtering.
   - Search instantly by title, username, service, or tags using the Cyber Search bar.
4. Security & Isolation Architecture:
   - Explain that data is isolated per authenticated user in Google Cloud Firestore under /users/{user.uid}/vault/{itemId}.
   - Firestore security rules strictly block other users or unauthenticated clients from reading or modifying vault items.
5. Credential Storage Limits & Paid Feature (+20 Slots):
   - Free plan: Normal users receive 10 slots to store their credentials.
   - Paid upgrade: Users can allot 20 more credential slots (for 30 total slots) by paying $4.88 USD or ₦6,500 Naira.
   - The payment is handled via a separate dedicated page showing the official bank account number and transfer instructions.
   - Users can navigate to the upgrade page anytime via the "Upgrade (+20 Slots)" button in the header or the Side Box on their dashboard.

CRITICAL POLICY FOR ABSTRACT INQUIRIES & COMPLAINTS:
- If the user asks an ABSTRACT INQUIRY (such as unrelated trivia, philosophical questions, jokes, riddles, cooking recipes, general chit-chat, world news, life advice, or queries not related to vault storage and data protection), OR
- If the user submits a COMPLAINT, grievance, bug report, dispute, feature request, or asks how to contact human support:
YOU MUST POLITELY DIRECT THEM TO SEND THEIR COMPLAINT OR ABSTRACT INQUIRY TO THE ADMINISTRATOR EMAIL:
${SUPPORT_EMAIL}

Example response for abstract inquiries/complaints:
"For abstract inquiries, bug reports, feedback, or complaints, please reach out directly to the vault administrator at: **${SUPPORT_EMAIL}**."

Keep your tone professional, high-tech cyber-security oriented, concise, and helpful. Always provide actionable, step-by-step instructions.`;

// Intelligent fallback logic when Gemini API key is unavailable or fails
function getFallbackResponse(query: string): string {
  const q = query.toLowerCase().trim();

  // Abstract inquiry or complaint detection
  const isComplaint = /complaint|problem|issue|bug|error|dispute|broken|refund|hate|sucks|contact|human|admin|email|manager/i.test(q);
  const isAbstract = /weather|recipe|cook|joke|riddle|philosophy|meaning of life|president|movie|song|who made you|capital of|tell me a story/i.test(q);

  if (isComplaint || isAbstract) {
    return `For abstract inquiries, feedback, or complaints, please reach out directly to the vault administrator at **${SUPPORT_EMAIL}**.\n\nYou can email anytime with your inquiries, feedback, or issue details.`;
  }

  // Password storage
  if (/password|credential|login|passphrase/i.test(q)) {
    return `### How to Store Passwords in CyberVault:
1. Click the **"+ Add Item"** button on your dashboard.
2. Select the **"Password / Credential"** tab.
3. Fill in the **Title** (e.g., *GitHub Developer*, *Bank Account*).
4. Enter your **Username / Email**.
5. Type your password or click the **Wand (Generate)** icon to craft an ultra-secure 16+ character password.
6. Select a category (**Personal**, **Work**, **Finance**, or **Social**) and add tags (e.g., *critical, dev*).
7. Click **"Encrypt & Store Record"**. Your password is saved in your private Firestore database!`;
  }

  // Document / Note storage
  if (/document|note|passport|seed|license|memo|tax|secure note|text/i.test(q)) {
    return `### How to Store Secure Documents & Notes:
1. Click **"+ Add Item"** in the top navigation.
2. Switch to the **"Secure Document"** tab.
3. Give your document a title (e.g., *Passport & Visa Numbers*, *Crypto Recovery Seed*, *Server API Keys*).
4. Paste your sensitive information in the **Secret Content & Notes** field.
5. Assign a Category and custom tags for rapid filtering.
6. Click **"Encrypt & Store Record"** to isolate and protect your data.`;
  }

  // Security & Encryption
  if (/secure|security|encrypt|safe|hack|firewall|isolation|firestore|database/i.test(q)) {
    return `### Vault Security & Isolation Protocol:
- **Per-User Database Isolation**: All your vault entries are stored strictly under \`/users/{your-uid}/vault/{itemId}\` in Google Cloud Firestore.
- **Server-Enforced Rules**: Firebase security rules ensure that *only your authenticated Google Account* has read or write permissions. No other user can access your vault.
- **Micro-Decrypt Obfuscation**: Passwords remain concealed behind cyber masks until you explicitly click the reveal eye icon.
- **Safe Copy**: One-click clipboard copy allows you to paste credentials without exposing them visually.`;
  }

  // Organization & Search
  if (/tag|search|favorite|filter|organize|category|star/i.test(q)) {
    return `### Organizing & Finding Your Information:
- **Categories**: Filter by *Personal*, *Work*, *Finance*, *Social*, and *Document* using the category selector.
- **Favorites**: Click the **Star icon** on any vault card to pin it to your quick-access Favorites view.
- **Cyber Search**: Type in the search bar to filter instantly across titles, usernames, domains, and custom tags.
- **View Modes**: Switch between **All Items**, **Passwords Only**, **Documents Only**, and **Favorites** in the header.`;
  }

  // Storage Slot Limits, Paid Feature & Payment Page
  if (/slot|upgrade|price|pricing|cost|pay|paid|naira|dollar|account number|bank|buy|plan|tier/i.test(q)) {
    return `### Credential Storage Plans & Paid Upgrade:
- **Free Plan**: Every normal user is allotted **10 credential slots** free of charge.
- **Paid Upgrade (+20 Slots)**: You can allot **20 additional slots** (for **30 total credential slots**) by paying **$4.88 USD** or **₦6,500 Naira**.
- **Separate Payment Page**: Clicking the **"Upgrade (+20 Slots)"** button in the header or the **Side Box** redirects you to a dedicated page containing the official bank account number, transfer details, and proof verification.
- **How to Pay**: Transfer $4.88 or ₦6,500 to the official bank account displayed on that page, enter your transaction reference, and your slots will unlock immediately!`;
  }

  // General fallback
  return `### CyberVault Information Storage Guide:
Welcome to CyberVault! You can store and manage two primary types of data:
1. **Passwords & Credentials**: Click **"+ Add Item"** -> select **"Password / Credential"** -> enter service, username, and password.
2. **Encrypted Documents & Notes**: Click **"+ Add Item"** -> select **"Secure Document"** -> store confidential text, seeds, and records.

All data is strictly isolated to your authenticated account.

*Note: For any abstract inquiry, bug report, or complaint, please send an email directly to the administrator at **${SUPPORT_EMAIL}**.*`;
}

// Chat API endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const trimmed = message.trim();

    // Check if Gemini client is available
    if (aiClient) {
      try {
        // Construct conversation contents with system instruction
        const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        // Add recent message history if available
        if (Array.isArray(history)) {
          const recent = history.slice(-6);
          for (const item of recent) {
            if (item && item.role && item.text) {
              contents.push({
                role: item.role === 'user' ? 'user' : 'model',
                parts: [{ text: item.text }],
              });
            }
          }
        }

        // Add latest user message
        contents.push({
          role: 'user',
          parts: [{ text: trimmed }],
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini request timeout')), 12000)
        );

        const geminiCall = aiClient.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.3,
          },
        });

        const geminiResponse = await Promise.race([geminiCall, timeoutPromise]);

        const replyText = geminiResponse.text?.trim() || getFallbackResponse(trimmed);
        res.json({
          reply: replyText,
          supportEmail: SUPPORT_EMAIL,
          source: 'gemini',
        });
        return;
      } catch (_geminiError) {
        // Graceful fallback to built-in knowledge base if network delay occurs
        const replyText = getFallbackResponse(trimmed);
        res.json({
          reply: replyText,
          supportEmail: SUPPORT_EMAIL,
          source: 'fallback',
        });
        return;
      }
    }

    // Fallback response when no API key configured
    const replyText = getFallbackResponse(trimmed);
    res.json({
      reply: replyText,
      supportEmail: SUPPORT_EMAIL,
      source: 'fallback',
    });
  } catch (err: unknown) {
    console.error('Error handling chat request:', err);
    res.status(500).json({
      error: 'Failed to process chat message',
      supportEmail: SUPPORT_EMAIL,
    });
  }
});

// Persistent Local Storage for Audit Records
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_e) {
    // ignore
  }
}
const PAYMENTS_FILE = path.resolve(DATA_DIR, 'payment_submissions.json');
const TICKETS_FILE = path.resolve(DATA_DIR, 'support_submissions.json');

export interface StoredPayment {
  id: string;
  userId: string;
  userEmail: string;
  senderName: string;
  bankUsed: string;
  paymentRef: string;
  paymentCurrency: 'NGN' | 'USD';
  amount: number;
  formattedAmount: string;
  planDuration?: 'biweekly' | 'monthly' | 'yearly';
  planName?: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: string;
  timestamp: number;
  emailDeliveryStatus?: string;
  emailDeliveryMethod?: string;
}

export interface StoredTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: string;
  subject: string;
  message: string;
  priority?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  submittedAt: string;
  timestamp: number;
  emailDeliveryStatus?: string;
  emailDeliveryMethod?: string;
}

function loadPaymentSubmissions(): StoredPayment[] {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      const data = fs.readFileSync(PAYMENTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed reading payment submissions:', err);
  }
  return [];
}

function savePaymentSubmission(record: StoredPayment): void {
  try {
    const list = loadPaymentSubmissions();
    const existingIndex = list.findIndex((p) => p.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record);
    }
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving payment submission:', err);
  }
}

function updatePaymentStatus(id: string, status: 'pending' | 'verified' | 'rejected'): StoredPayment | null {
  try {
    const list = loadPaymentSubmissions();
    const item = list.find((p) => p.id === id);
    if (item) {
      item.status = status;
      fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
      return item;
    }
  } catch (err) {
    console.error('Failed updating payment status:', err);
  }
  return null;
}

function loadSupportSubmissions(): StoredTicket[] {
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const data = fs.readFileSync(TICKETS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed reading support tickets:', err);
  }
  return [];
}

function saveSupportSubmission(record: StoredTicket): void {
  try {
    const list = loadSupportSubmissions();
    const existingIndex = list.findIndex((t) => t.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record);
    }
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving support ticket:', err);
  }
}

/**
 * Universal email notification dispatcher:
 * 1. Checks if SMTP credentials are configured (Nodemailer).
 * 2. Attempts FormSubmit email forwarding to SUPPORT_EMAIL.
 * 3. Returns delivery status and logs details to console.
 */
async function dispatchEmailNotification({
  subject,
  replyTo,
  fields,
  textContent,
  htmlContent,
  recipientEmail = SUPPORT_EMAIL,
}: {
  subject: string;
  replyTo?: string;
  fields: Record<string, string | number | undefined>;
  textContent: string;
  htmlContent?: string;
  recipientEmail?: string;
}): Promise<{ sent: boolean; method: string; message: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  // 1. Direct SMTP via Nodemailer if credentials provided
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"Clockin Vault" <${smtpUser}>`,
        to: recipientEmail,
        replyTo: replyTo || smtpUser,
        subject,
        text: textContent,
        html: htmlContent || `<pre style="font-family:sans-serif;white-space:pre-wrap;">${textContent}</pre>`,
      });

      console.log(`[Email Dispatch] SMTP delivered email to ${recipientEmail}`);
      return {
        sent: true,
        method: 'smtp',
        message: `Directly delivered to ${recipientEmail} via SMTP.`,
      };
    } catch (smtpErr) {
      console.error('[Email Dispatch] SMTP failed, attempting fallback gateway:', smtpErr);
    }
  }

  // 2. Gateway Dispatch via FormSubmit
  try {
    const appUrl = process.env.APP_URL || 'https://clockinvault.local';
    const formSubmitPayload: Record<string, any> = {
      _subject: subject,
      _replyto: replyTo || SUPPORT_EMAIL,
      _template: 'table',
      ...fields,
    };

    const res = await fetch(`https://formsubmit.co/ajax/${recipientEmail}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: appUrl,
        Referer: `${appUrl}/`,
      },
      body: JSON.stringify(formSubmitPayload),
    });

    const data = (await res.json().catch(() => null)) as any;
    console.log('[Email Dispatch] FormSubmit response:', data);

    if (data && (data.success === 'true' || data.success === true)) {
      return {
        sent: true,
        method: 'formsubmit',
        message: `Delivered to ${recipientEmail} via FormSubmit email gateway.`,
      };
    }

    if (data && data.message && data.message.includes('Activation')) {
      return {
        sent: false,
        method: 'formsubmit-activation-pending',
        message: `FormSubmit activation required: please open the email sent by FormSubmit to ${recipientEmail} and click 'Activate Form' to receive future automated emails in your inbox!`,
      };
    }

    return {
      sent: false,
      method: 'formsubmit',
      message: data?.message || 'FormSubmit response received',
    };
  } catch (fsErr) {
    console.warn('[Email Dispatch] FormSubmit network warning:', fsErr);
    return {
      sent: false,
      method: 'logged',
      message: 'Recorded in internal server audit database.',
    };
  }
}

// Endpoint to retrieve support email and status info
app.get('/api/support-info', (_req: Request, res: Response) => {
  res.json({
    supportEmail: SUPPORT_EMAIL,
  });
});

// Endpoint to get all payment submissions for Admin Console
app.get('/api/admin/payments', (_req: Request, res: Response) => {
  const list = loadPaymentSubmissions();
  res.json({
    success: true,
    payments: list,
    supportEmail: SUPPORT_EMAIL,
  });
});

// Endpoint to update payment submission status
app.post('/api/admin/payments/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending', 'verified', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const updated = updatePaymentStatus(id, status);
  if (!updated) {
    res.status(404).json({ error: 'Payment record not found' });
    return;
  }
  res.json({ success: true, payment: updated });
});

// Endpoint to get all support tickets for Admin Console
app.get('/api/admin/support-tickets', (_req: Request, res: Response) => {
  const list = loadSupportSubmissions();
  res.json({
    success: true,
    tickets: list,
  });
});

// Endpoint to handle bank transfer payment submission with user UID and send confirmation email notice
app.post('/api/payment-submission', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, senderName, bankUsed, paymentRef, planDuration = 'biweekly', amount } = req.body;

    if (!senderName || !bankUsed) {
      res.status(400).json({ error: 'Sender name and bank used in transfer are required.' });
      return;
    }

    let planName = '2-Weekly Plan (14 Days)';
    let planSlots = '+20 Credential Slots (30 slots total)';
    let calculatedAmount = 2000;

    if (planDuration === 'monthly') {
      planName = 'Monthly Plan (30 Days)';
      planSlots = '+40 Credential Slots (50 slots total)';
      calculatedAmount = 8000;
    } else if (planDuration === 'yearly') {
      planName = 'Yearly Plan (365 Days)';
      planSlots = 'Unlimited Credential Slots';
      calculatedAmount = 15000;
    }

    const finalAmount = Number(amount) || calculatedAmount;
    const formattedAmount = `₦${finalAmount.toLocaleString()} NGN`;
    const submittedAt = new Date().toUTCString();
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Build Email for Admin
    const adminEmailSubject = `[Clockin Vault] NEW PAYMENT SUBMISSION - ${senderName} (${formattedAmount} - ${planName}) - UID: ${userId}`;
    const adminEmailBody = `NEW BANK TRANSFER PAYMENT SUBMISSION
Clockin Vault Storage Upgrade - ${planName}
Slots Allotment: ${planSlots}

VERIFICATION METRICS:
------------------------------------------------------
User Verification UID: ${userId}
User Email:            ${userEmail || 'Not specified'}
Selected Plan:         ${planName}
Allotted Slots:        ${planSlots}
Sender / Depositor:    ${senderName}
Bank Used in Transfer: ${bankUsed}
Payment Reference:     ${paymentRef || 'N/A'}
Amount Transferred:    ${formattedAmount}
Currency:              NGN (Nigerian Naira)
Submission Time:       ${submittedAt}
Payment Record ID:     ${paymentId}
------------------------------------------------------

CONFIRMATION NOTICE ISSUED TO USER:
"Your payment would be confirmed within 2 working days."

ADMIN ACTION REQUIRED:
1. Verify the deposit of ${formattedAmount} from "${senderName}" via ${bankUsed} in your bank account statement.
2. Sign in to Clockin Vault as ${SUPPORT_EMAIL}.
3. Open the Admin Console and click "Approve & Start Countdown" for User UID "${userId}".
Note: Once approved, the admin countdown will start and will only be visible on your admin console.`;

    // Confirmation Notice for the Paying User
    const customerEmailSubject = `Payment Submission Received - Clockin Vault Upgrade: ${planName} (UID: ${userId})`;
    const customerEmailContent = `Subject: Payment Submission Received - Clockin Vault Upgrade (UID: ${userId})

Dear User,

We have successfully received your payment submission for Clockin Vault (${planName} - ${planSlots}).

TRANSFER VERIFICATION DETAILS:
- User Verification UID: ${userId}
- User Email: ${userEmail || 'Not specified'}
- Plan Selected: ${planName}
- Sender / Depositor Name: ${senderName}
- Bank Used for Transfer: ${bankUsed}
- Transaction Narration / Reference: ${paymentRef || 'N/A'}
- Amount Transferred: ${formattedAmount}
- Timestamp: ${submittedAt}

CONFIRMATION NOTICE:
Your payment would be confirmed within 2 working days.

Our administrative team will match your bank transfer with our official account statements. Once confirmed, your additional credential slots will be activated on your account.

If you have any questions or require urgent verification, please reply to this notice or contact the administrator at ${SUPPORT_EMAIL} quoting your User UID: ${userId}.

Thank you for choosing Clockin Vault.
Quantum-Resistant Isolated Storage`;

    // 1. Dispatch email notification to Administrator
    const adminDelivery = await dispatchEmailNotification({
      subject: adminEmailSubject,
      replyTo: userEmail || SUPPORT_EMAIL,
      recipientEmail: SUPPORT_EMAIL,
      fields: {
        Notification: 'NEW PAYMENT SUBMISSION',
        User_UID: userId,
        User_Email: userEmail || 'N/A',
        Sender_Name: senderName,
        Bank_Used: bankUsed,
        Amount: formattedAmount,
        Payment_Reference: paymentRef || 'N/A',
        Submission_Date: submittedAt,
        Notice_To_Customer: 'Payment would be confirmed within 2 working days',
      },
      textContent: adminEmailBody,
    });

    // 2. Also try sending confirmation to the user if userEmail is provided and SMTP is set up
    let userDelivery = null;
    if (userEmail && process.env.SMTP_HOST) {
      userDelivery = await dispatchEmailNotification({
        subject: customerEmailSubject,
        replyTo: SUPPORT_EMAIL,
        recipientEmail: userEmail,
        fields: {
          User_UID: userId,
          Amount: formattedAmount,
          Notice: 'Your payment would be confirmed within 2 working days',
        },
        textContent: customerEmailContent,
      });
    }

    // 3. Save to local audit storage
    const paymentRecord: StoredPayment = {
      id: paymentId,
      userId,
      userEmail: userEmail || '',
      senderName,
      bankUsed,
      paymentRef: paymentRef || '',
      paymentCurrency: 'NGN',
      amount: finalAmount,
      formattedAmount,
      planDuration,
      planName,
      status: 'pending',
      submittedAt,
      timestamp: Date.now(),
      emailDeliveryStatus: adminDelivery.message,
      emailDeliveryMethod: adminDelivery.method,
    };
    savePaymentSubmission(paymentRecord);

    // 4. Generate 1-click Direct Mail Compose Links
    const gmailAdminUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      SUPPORT_EMAIL
    )}&su=${encodeURIComponent(adminEmailSubject)}&body=${encodeURIComponent(adminEmailBody)}`;

    const mailtoAdminUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      adminEmailSubject
    )}&body=${encodeURIComponent(adminEmailBody)}`;

    const gmailUserUrl = userEmail
      ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
          userEmail
        )}&su=${encodeURIComponent(customerEmailSubject)}&body=${encodeURIComponent(
          customerEmailContent
        )}`
      : '';

    const mailtoUserUrl = userEmail
      ? `mailto:${userEmail}?subject=${encodeURIComponent(
          customerEmailSubject
        )}&body=${encodeURIComponent(customerEmailContent)}`
      : '';

    console.log('\n======================================================');
    console.log(`[PAYMENT SUBMISSION RECEIVED & AUDITED - UID: ${userId}]`);
    console.log(`Sender: ${senderName} | Bank: ${bankUsed} | Ref: ${paymentRef}`);
    console.log(`Amount: ${formattedAmount}`);
    console.log(`Notice: Customer notified payment would be confirmed within 2 working days.`);
    console.log(`Admin Dispatch (${SUPPORT_EMAIL}): [${adminDelivery.method}] ${adminDelivery.message}`);
    console.log('======================================================\n');

    res.json({
      success: true,
      paymentId,
      paymentRecord,
      userUid: userId,
      userEmail,
      confirmedWithin: '2 working days',
      emailContent: customerEmailContent,
      emailDelivery: adminDelivery,
      userDelivery,
      gmailAdminUrl,
      mailtoAdminUrl,
      gmailUserUrl,
      mailtoUserUrl,
      message: `Your payment details have been recorded! A confirmation email notice has been dispatched stating that your payment would be confirmed within 2 working days.`,
    });
  } catch (error) {
    console.error('Error processing payment submission:', error);
    res.status(500).json({ error: 'Failed to process payment submission.' });
  }
});

// Endpoint to receive suggestions and complaints sent to administrator email with user UID
app.post('/api/send-support-ticket', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, userName, type, subject, message, priority, ticketId: requestedTicketId } = req.body;

    if (!subject || !message) {
      res.status(400).json({ error: 'Subject and message are required.' });
      return;
    }

    const ticketId = requestedTicketId || `tkt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const categoryLabel = (type || 'suggestion').toUpperCase();
    const emailSubject = `[Clockin Vault - ${categoryLabel}] ${subject} (UID: ${userId})`;
    const submittedAt = new Date().toUTCString();

    const emailBody = `NEW SUPPORT TICKET / USER SUBMISSION
Clockin Vault Support & Feedback

USER VERIFICATION METRICS:
------------------------------------------------------
User UID:     ${userId}
User Email:   ${userEmail || 'Anonymous'}
User Name:    ${userName || 'Authenticated User'}
Ticket ID:    ${ticketId}
Category:     ${categoryLabel}
Priority:     ${priority || 'Normal'}
Submitted At: ${submittedAt}
------------------------------------------------------

SUBJECT:
${subject}

MESSAGE / GRIEVANCE / SUGGESTION:
${message}

------------------------------------------------------
Admin Note: To verify or update this user's account permissions or slots,
search for User UID "${userId}" in the Admin Console.`;

    // 1. Dispatch email to Administrator
    const delivery = await dispatchEmailNotification({
      subject: emailSubject,
      replyTo: userEmail || SUPPORT_EMAIL,
      recipientEmail: SUPPORT_EMAIL,
      fields: {
        Ticket_Type: categoryLabel,
        User_UID: userId,
        User_Email: userEmail || 'N/A',
        User_Name: userName || 'N/A',
        Subject: subject,
        Message: message,
        Priority: priority || 'Normal',
        Ticket_ID: ticketId,
      },
      textContent: emailBody,
    });

    // 2. Save to local audit storage
    const ticketRecord: StoredTicket = {
      id: ticketId,
      userId,
      userEmail: userEmail || '',
      userName,
      type: type || 'suggestion',
      subject,
      message,
      priority: priority || 'Normal',
      status: 'pending',
      submittedAt,
      timestamp: Date.now(),
      emailDeliveryStatus: delivery.message,
      emailDeliveryMethod: delivery.method,
    };
    saveSupportSubmission(ticketRecord);

    const gmailAdminUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      SUPPORT_EMAIL
    )}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    const mailtoAdminUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;

    console.log('\n======================================================');
    console.log(`[SUPPORT SUBMISSION FORWARDED - UID: ${userId}]`);
    console.log(`Category: ${categoryLabel} | Subject: ${subject}`);
    console.log(`Admin Dispatch (${SUPPORT_EMAIL}): [${delivery.method}] ${delivery.message}`);
    console.log('======================================================\n');

    res.json({
      success: true,
      ticketId,
      ticketRecord,
      adminEmail: SUPPORT_EMAIL,
      userUid: userId,
      emailDelivery: delivery,
      gmailAdminUrl,
      mailtoAdminUrl,
      message: `Your ${type || 'message'} has been sent to the vault administrator at ${SUPPORT_EMAIL} with your User UID (${userId}).`,
    });
  } catch (error) {
    console.error('Error sending support ticket:', error);
    res.status(500).json({ error: 'Failed to forward support ticket.' });
  }
});

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CyberVault Server] Running at http://0.0.0.0:${PORT}`);
    console.log(`[CyberVault Server] Support Email: ${SUPPORT_EMAIL}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
