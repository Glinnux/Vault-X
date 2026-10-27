import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SupportTicket, PaymentSubmissionLog } from '../types/vault';

export const ADMIN_SUPPORT_EMAIL = 'oluwolefaith92@gmail.com';

/**
 * Submit user suggestion or complaint to admin email and Firestore
 */
export async function submitSupportTicket(data: {
  userId: string;
  userEmail: string;
  userName?: string;
  type: 'suggestion' | 'complaint' | 'inquiry' | 'payment';
  subject: string;
  message: string;
  priority?: 'normal' | 'high' | 'urgent';
}): Promise<{
  ticketId: string;
  mailtoUrl: string;
  gmailUrl?: string;
  serverDispatched: boolean;
  emailDelivery?: any;
}> {
  // Generate valid Firestore ID (letters, numbers, hyphens)
  const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const ticketRef = doc(db, 'support_tickets', ticketId);

  // 1. Save ticket into Firestore
  const ticketData = {
    id: ticketId,
    userId: data.userId,
    userEmail: data.userEmail.toLowerCase().trim(),
    userName: (data.userName || 'Vault X User').slice(0, 120),
    type: data.type,
    subject: data.subject.trim().slice(0, 200),
    message: data.message.trim().slice(0, 5000),
    status: 'pending' as const,
    createdAt: serverTimestamp(),
  };

  await setDoc(ticketRef, ticketData);

  // 2. Prepare mailto fallback URL pre-filled with User UID
  const emailSubject = `[Vault X - ${data.type.toUpperCase()}] ${data.subject} (UID: ${data.userId})`;
  const emailBody = `Dear Administrator (Faith Oluwole),

Here is a ${data.type.toUpperCase()} submitted from Vault X:

==========================================
USER VERIFICATION DETAILS:
User UID: ${data.userId}
User Email: ${data.userEmail}
User Name: ${data.userName || 'Google Authenticated User'}
Priority: ${data.priority || 'normal'}
Ticket ID: ${ticketId}
Date: ${new Date().toLocaleString()}
==========================================

SUBJECT:
${data.subject}

MESSAGE / DETAILS:
${data.message}

------------------------------------------
Please inspect this user's account using the Verification UID: ${data.userId}`;

  const mailtoUrl = `mailto:${ADMIN_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    emailSubject
  )}&body=${encodeURIComponent(emailBody)}`;

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    ADMIN_SUPPORT_EMAIL
  )}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  // 3. Dispatch to backend API to ensure server-side delivery to ADMIN_SUPPORT_EMAIL
  let serverDispatched = false;
  let emailDelivery = undefined;
  try {
    const res = await fetch('/api/send-support-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        ticketId,
        emailSubject,
        emailBody,
        adminEmail: ADMIN_SUPPORT_EMAIL,
      }),
    });
    if (res.ok) {
      serverDispatched = true;
      const resData = await res.json();
      emailDelivery = resData.emailDelivery;
    }
  } catch (err) {
    console.warn('Backend email dispatch warning (ticket stored in Firestore):', err);
  }

  return { ticketId, mailtoUrl, gmailUrl, serverDispatched, emailDelivery };
}

export interface PaymentVerificationResult {
  success: boolean;
  confirmationNotice: string;
  emailContent: string;
  confirmedWithin: string;
  emailDelivery?: { sent: boolean; method: string; message: string };
  gmailAdminUrl?: string;
  mailtoAdminUrl?: string;
  gmailUserUrl?: string;
  mailtoUserUrl?: string;
}

export interface ServerPaymentRecord {
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

/**
 * Fetch server-audited payment records for the Admin Console
 */
export async function fetchServerPayments(): Promise<ServerPaymentRecord[]> {
  try {
    const res = await fetch('/api/admin/payments');
    if (res.ok) {
      const data = await res.json();
      return data.payments || [];
    }
  } catch (err) {
    console.warn('Error fetching server payments:', err);
  }
  return [];
}

/**
 * Update payment record status on the server
 */
export async function updateServerPaymentStatus(
  paymentId: string,
  status: 'pending' | 'verified' | 'rejected'
): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/payments/${paymentId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error updating payment status on server:', err);
    return false;
  }
}

/**
 * Submit payment notification details and receive confirmation email notice
 */
export async function submitPaymentVerification(data: {
  userId: string;
  userEmail: string;
  senderName: string;
  bankUsed: string;
  paymentRef: string;
  paymentCurrency?: 'NGN' | 'USD';
  amount: number;
  planDuration?: 'biweekly' | 'monthly' | 'yearly';
  receipt: { name: string; type: string; size: number; data: string };
}): Promise<PaymentVerificationResult> {
  const planDuration = data.planDuration || 'biweekly';
  const currency = 'NGN';

  // 1. Update user profile document with payment details
  const userDocRef = doc(db, 'users', data.userId);
  try {
    await updateDoc(userDocRef, {
      senderName: data.senderName.trim().slice(0, 120),
      bankUsed: data.bankUsed.trim().slice(0, 100),
      paymentRef: data.paymentRef.trim().slice(0, 200),
      paymentCurrency: currency,
      planDuration,
      paymentStatus: 'pending',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore user payment update warning:', err);
  }

  // 2. Also record in support_tickets as a payment confirmation record so admin and user track it
  try {
    const ticketId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const ticketRef = doc(db, 'support_tickets', ticketId);
    await setDoc(ticketRef, {
      id: ticketId,
      userId: data.userId,
      userEmail: data.userEmail.toLowerCase().trim(),
      userName: data.senderName.trim(),
      type: 'payment',
      subject: `Payment Verification: ₦${data.amount} for ${planDuration.toUpperCase()} Plan (${data.bankUsed})`,
      message: `Plan Selected: ${planDuration.toUpperCase()}
Sender Name / Depositor: ${data.senderName}
Bank Used for Transfer: ${data.bankUsed}
Payment Reference / Narration: ${data.paymentRef}
Amount: ₦${data.amount} NGN
Notice: Customer notified payment would be confirmed within 2 working days.
User UID for Verification: ${data.userId}`,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Payment ticket record warning:', err);
  }

  // 3. Dispatch to backend API to send email to admin and user
  try {
    const res = await fetch('/api/payment-submission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: data.userId,
        userEmail: data.userEmail,
        senderName: data.senderName,
        bankUsed: data.bankUsed,
        paymentRef: data.paymentRef,
        paymentCurrency: currency,
        planDuration,
        amount: data.amount,
        receipt: data.receipt,
        adminEmail: ADMIN_SUPPORT_EMAIL,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      return {
        success: true,
        confirmationNotice: result.message || 'Payment submission received. Your payment would be confirmed within 2 working days.',
        emailContent: result.emailContent || '',
        confirmedWithin: result.confirmedWithin || '2 working days',
        emailDelivery: result.emailDelivery,
        gmailAdminUrl: result.gmailAdminUrl,
        mailtoAdminUrl: result.mailtoAdminUrl,
        gmailUserUrl: result.gmailUserUrl,
        mailtoUserUrl: result.mailtoUserUrl,
      };
    }
  } catch (err) {
    console.warn('Backend payment notification warning:', err);
  }

  const fallbackEmail = `Hello,

We have successfully received your payment submission for Vault X (+20 Slots Upgrade).

TRANSFER DETAILS:
- User UID: ${data.userId}
- Sender / Depositor Name: ${data.senderName}
- Bank Used in Transfer: ${data.bankUsed}
- Payment Reference: ${data.paymentRef}
- Amount: ${data.paymentCurrency === 'NGN' ? `₦${data.amount.toLocaleString()}` : `$${data.amount}`}

CONFIRMATION NOTICE:
Your payment would be confirmed within 2 working days.

Once verified by our administrative team, your extra 20 credential slots (30 total) will be automatically credited to your vault.

For inquiries, contact the administrator directly at ${ADMIN_SUPPORT_EMAIL} with your Verification UID (${data.userId}).`;

  const fallbackSubject = `[Vault X] NEW PAYMENT - ${data.senderName} - UID: ${data.userId}`;
  const gmailAdminUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    ADMIN_SUPPORT_EMAIL
  )}&su=${encodeURIComponent(fallbackSubject)}&body=${encodeURIComponent(fallbackEmail)}`;
  const mailtoAdminUrl = `mailto:${ADMIN_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    fallbackSubject
  )}&body=${encodeURIComponent(fallbackEmail)}`;

  return {
    success: true,
    confirmationNotice: 'Your payment submission has been received. Your payment would be confirmed within 2 working days.',
    emailContent: fallbackEmail,
    confirmedWithin: '2 working days',
    gmailAdminUrl,
    mailtoAdminUrl,
  };
}

/**
 * Subscribe to current user's tickets in real-time
 */
export function subscribeToUserTickets(
  userId: string,
  onUpdate: (tickets: SupportTicket[]) => void
): () => void {
  try {
    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const tickets: SupportTicket[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            userEmail: data.userEmail,
            userName: data.userName,
            type: data.type || 'suggestion',
            subject: data.subject || 'Support Request',
            message: data.message || '',
            status: data.status || 'pending',
            createdAt: data.createdAt,
          };
        });
        onUpdate(tickets);
      },
      (err) => {
        console.warn('User tickets subscription warning:', err);
        onUpdate([]);
      }
    );
  } catch (err) {
    console.warn('Failed to setup tickets listener:', err);
    onUpdate([]);
    return () => {};
  }
}

/**
 * Subscribe to all tickets (Admin only)
 */
export function subscribeToAllTickets(
  onUpdate: (tickets: SupportTicket[]) => void
): () => void {
  try {
    const q = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const tickets: SupportTicket[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: data.userId,
            userEmail: data.userEmail,
            userName: data.userName,
            type: data.type || 'suggestion',
            subject: data.subject || 'Support Request',
            message: data.message || '',
            status: data.status || 'pending',
            createdAt: data.createdAt,
          };
        });
        onUpdate(tickets);
      },
      (err) => {
        console.warn('Admin tickets subscription warning:', err);
        onUpdate([]);
      }
    );
  } catch (err) {
    console.warn('Failed to setup admin tickets listener:', err);
    onUpdate([]);
    return () => {};
  }
}

/**
 * Admin: Update ticket status (e.g. pending -> reviewed -> resolved)
 */
export async function updateTicketStatus(
  ticketId: string,
  status: 'pending' | 'reviewed' | 'resolved'
): Promise<void> {
  const ticketRef = doc(db, 'support_tickets', ticketId);
  await updateDoc(ticketRef, {
    status,
  });
}
