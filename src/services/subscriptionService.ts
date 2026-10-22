import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BankAccountDetails, UserSubscription, PlanDuration, PlanOption } from '../types/vault';
import { ADMIN_EMAIL, isUserAdmin } from './adminService';

export const FREE_CREDENTIAL_SLOTS = 10;
export const UNLIMITED_CREDENTIAL_SLOTS = 999999;

export const SUBSCRIPTION_PLANS: PlanOption[] = [
  {
    id: 'biweekly',
    name: '2-Weekly Plan',
    priceNGN: 2000,
    formattedPrice: '₦2,000 NGN',
    durationDays: 14,
    durationLabel: '14 Days',
    additionalSlots: 20,
    totalSlots: 30, // 10 base + 20 extra
    description: 'Unlocks +20 credential slots (30 slots total) for 14 days.',
  },
  {
    id: 'monthly',
    name: 'Monthly Plan',
    priceNGN: 8000,
    formattedPrice: '₦8,000 NGN',
    durationDays: 30,
    durationLabel: '30 Days',
    additionalSlots: 40,
    totalSlots: 50, // 10 base + 40 extra
    popular: true,
    description: 'Unlocks +40 credential slots (50 slots total) for 30 days.',
  },
  {
    id: 'yearly',
    name: 'Yearly Plan',
    priceNGN: 15000,
    formattedPrice: '₦15,000 NGN',
    durationDays: 365,
    durationLabel: '1 Year (365 Days)',
    additionalSlots: UNLIMITED_CREDENTIAL_SLOTS,
    totalSlots: UNLIMITED_CREDENTIAL_SLOTS,
    isUnlimited: true,
    description: 'Unlocks unlimited credential & document slots for a full year (365 days).',
  },
];

export function getPlanOption(id: PlanDuration): PlanOption {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) || SUBSCRIPTION_PLANS[0];
}

const DEFAULT_BANK_DETAILS: BankAccountDetails = {
  bankName: 'Guaranty Trust Bank (GTBank)',
  accountNumber: '0812345678', // Official bank transfer account number
  accountName: 'Faith Oluwole / Vault X',
  instructions:
    'Transfer the fee for your chosen plan in Nigerian Naira (₦) to the bank account below. Once transferred, enter your depositor name and reference to submit for admin confirmation.',
  routingOrSortCode: '058-152062',
};

const BANK_DETAILS_STORAGE_KEY = 'clockin_vault_bank_details';
const LOCAL_PLAN_PREFIX = 'clockin_vault_plan_';

export function getBankTransferDetails(): BankAccountDetails {
  try {
    const raw = localStorage.getItem(BANK_DETAILS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_BANK_DETAILS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Error reading stored bank details:', e);
  }
  return DEFAULT_BANK_DETAILS;
}

export function saveBankTransferDetails(details: Partial<BankAccountDetails>): BankAccountDetails {
  const current = getBankTransferDetails();
  const updated = { ...current, ...details };
  try {
    localStorage.setItem(BANK_DETAILS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error saving bank details:', e);
  }
  return updated;
}

/**
 * Checks if a subscription has expired based on timestamp.
 * Admin account is never considered lapsed.
 */
export function isSubscriptionLapsed(sub?: UserSubscription | null): boolean {
  if (!sub || sub.plan === 'free') return false;
  if (sub.isUnlimited && !sub.expiresAt) return false; // Admin owner is permanently unlimited
  if (sub.expiresAt && Date.now() > sub.expiresAt) {
    return true;
  }
  return Boolean(sub.isExpired);
}

/**
 * Determines whether a specific credential slot index is editable.
 * Rules:
 * 1. Base 10 slots (indices 0 through 9) can ALWAYS be edited.
 * 2. If subscription is active, all slots up to maxCredentialSlots can be edited.
 * 3. When countdown is up (subscription expired):
 *    - User space resets to 0 extra slots.
 *    - Slots 11 and above (indices >= 10) are VIEW-ONLY (passwords can be viewed & copied, but edit is locked).
 */
export function canEditSlotItem(
  slotIndex: number,
  sub?: UserSubscription | null,
  isOwnerAdmin: boolean = false
): boolean {
  if (isOwnerAdmin) return true;
  if (slotIndex < FREE_CREDENTIAL_SLOTS) return true; // first 10 slots always editable
  if (isSubscriptionLapsed(sub)) {
    return false; // extra slots are view-only after subscription countdown ends
  }
  const maxSlots = sub?.maxCredentialSlots || FREE_CREDENTIAL_SLOTS;
  return slotIndex < maxSlots;
}

/**
 * Formats remaining countdown time nicely for Admin Console:
 * e.g. "13d 21h 45m 12s", "29d 14h 02m 00s", or "EXPIRED"
 */
export function formatRemainingCountdown(expiresAt?: number | null): {
  text: string;
  isExpired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  if (!expiresAt) {
    return {
      text: 'No Expiration (Permanent)',
      isExpired: false,
      days: 999,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: Infinity,
    };
  }

  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) {
    return {
      text: '00d 00h 00m 00s (EXPIRED)',
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const text = `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  return {
    text,
    isExpired: false,
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
  };
}

/**
 * Subscribes to real-time subscription status for a user from Firestore.
 * Automatically computes expiry states.
 */
export function subscribeToUserSubscription(
  userId: string,
  userEmail: string | null | undefined,
  onUpdate: (subscription: UserSubscription) => void
): () => void {
  const isOwnerOrAdmin = Boolean(
    userEmail && (isUserAdmin(userEmail) || userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase())
  );

  // Initial local state for zero-latency UI
  const localKey = `${LOCAL_PLAN_PREFIX}${userId}`;
  let initialPlan: UserSubscription = isOwnerOrAdmin
    ? {
        plan: 'unlimited',
        extraSlots: UNLIMITED_CREDENTIAL_SLOTS,
        maxCredentialSlots: UNLIMITED_CREDENTIAL_SLOTS,
        isUnlimited: true,
        paymentStatus: 'verified',
        paymentRef: 'OWNER-UNRESTRICTED',
      }
    : {
        plan: 'free',
        extraSlots: 0,
        maxCredentialSlots: FREE_CREDENTIAL_SLOTS,
        isUnlimited: false,
        paymentStatus: 'none',
      };

  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.plan === 'unlimited' || isOwnerOrAdmin) {
        initialPlan = {
          plan: 'unlimited',
          extraSlots: UNLIMITED_CREDENTIAL_SLOTS,
          maxCredentialSlots: UNLIMITED_CREDENTIAL_SLOTS,
          isUnlimited: true,
          paymentStatus: 'verified',
          paymentRef: parsed.paymentRef || 'OWNER-UNRESTRICTED',
        };
      } else if (parsed.plan === 'paid' || parsed.planDuration) {
        const hasExpired = parsed.expiresAt ? Date.now() > parsed.expiresAt : false;
        initialPlan = {
          plan: parsed.plan,
          planDuration: parsed.planDuration,
          extraSlots: hasExpired ? 0 : parsed.extraSlots,
          maxCredentialSlots: hasExpired ? FREE_CREDENTIAL_SLOTS : parsed.maxCredentialSlots,
          isUnlimited: parsed.isUnlimited && !hasExpired,
          paymentStatus: parsed.paymentStatus || 'verified',
          paymentRef: parsed.paymentRef,
          paymentCurrency: 'NGN',
          approvedAt: parsed.approvedAt,
          expiresAt: parsed.expiresAt,
          isExpired: hasExpired,
        };
      }
    }
  } catch (err) {
    console.warn('Local plan parse error:', err);
  }

  onUpdate(initialPlan);

  // Real-time Firestore sync
  const userDocRef = doc(db, 'users', userId);

  // If owner/admin, ensure their Firestore doc has unlimited plan saved
  if (isOwnerOrAdmin) {
    updateDoc(userDocRef, {
      plan: 'unlimited',
      extraSlots: UNLIMITED_CREDENTIAL_SLOTS,
      maxCredentialSlots: UNLIMITED_CREDENTIAL_SLOTS,
      paymentStatus: 'verified',
      updatedAt: serverTimestamp(),
    }).catch(() => {
      // Best-effort sync
    });
  }

  return onSnapshot(
    userDocRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(initialPlan);
        return;
      }

      const data = snapshot.data();
      const isDocUnlimited = data.plan === 'unlimited' || isOwnerOrAdmin || data.role === 'admin';

      if (isDocUnlimited && !data.expiresAt) {
        const sub: UserSubscription = {
          plan: 'unlimited',
          extraSlots: UNLIMITED_CREDENTIAL_SLOTS,
          maxCredentialSlots: UNLIMITED_CREDENTIAL_SLOTS,
          isUnlimited: true,
          paymentStatus: 'verified',
          paymentRef: data.paymentRef || 'OWNER-UNRESTRICTED',
          paymentCurrency: 'NGN',
        };
        try {
          localStorage.setItem(localKey, JSON.stringify(sub));
        } catch (_e) {}
        onUpdate(sub);
        return;
      }

      const hasExpired = data.expiresAt ? Date.now() > data.expiresAt : false;
      const isPaid = data.plan === 'paid' || data.planDuration != null;

      const planOpt = data.planDuration
        ? getPlanOption(data.planDuration as PlanDuration)
        : SUBSCRIPTION_PLANS[0];

      const sub: UserSubscription = {
        plan: isPaid ? 'paid' : 'free',
        planDuration: data.planDuration as PlanDuration | undefined,
        // When countdown expires: reset extra space to 0!
        extraSlots: hasExpired ? 0 : (data.extraSlots ?? planOpt.additionalSlots),
        maxCredentialSlots: hasExpired ? FREE_CREDENTIAL_SLOTS : (data.maxCredentialSlots ?? planOpt.totalSlots),
        isUnlimited: (data.plan === 'yearly' || planOpt.isUnlimited) && !hasExpired,
        paymentStatus: data.paymentStatus || (isPaid ? 'verified' : 'none'),
        paymentRef: data.paymentRef,
        paymentCurrency: 'NGN',
        approvedAt: data.approvedAt,
        expiresAt: data.expiresAt,
        isExpired: hasExpired,
        isBanned: Boolean(data.isBanned),
        bannedReason: data.bannedReason || '',
      };

      try {
        localStorage.setItem(localKey, JSON.stringify(sub));
      } catch (e) {
        // silent
      }

      onUpdate(sub);
    },
    (err) => {
      console.warn('Subscription sync warning (using cached plan):', err);
      onUpdate(initialPlan);
    }
  );
}

/**
 * Activates a paid plan with duration and sets the initial expiration countdown
 */
export async function activatePaidPlan(
  userId: string,
  details: {
    planDuration: PlanDuration;
    paymentRef: string;
    senderName?: string;
    bankUsed?: string;
    status?: 'pending' | 'verified';
  }
): Promise<void> {
  const plan = getPlanOption(details.planDuration);
  const now = Date.now();
  const expiresAt = now + plan.durationDays * 86400 * 1000;

  const localKey = `${LOCAL_PLAN_PREFIX}${userId}`;
  const subData: UserSubscription = {
    plan: 'paid',
    planDuration: details.planDuration,
    extraSlots: plan.additionalSlots,
    maxCredentialSlots: plan.totalSlots,
    isUnlimited: Boolean(plan.isUnlimited),
    paymentStatus: details.status || 'verified',
    paymentRef: details.paymentRef,
    paymentCurrency: 'NGN',
    senderName: details.senderName,
    bankUsed: details.bankUsed,
    approvedAt: now,
    expiresAt,
    isExpired: false,
  };

  try {
    localStorage.setItem(localKey, JSON.stringify(subData));
  } catch (e) {}

  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      plan: 'paid',
      planDuration: details.planDuration,
      extraSlots: plan.additionalSlots,
      maxCredentialSlots: plan.totalSlots,
      approvedAt: now,
      expiresAt,
      isExpired: false,
      paymentStatus: details.status || 'verified',
      paymentRef: details.paymentRef.slice(0, 200),
      paymentCurrency: 'NGN',
      senderName: details.senderName || '',
      bankUsed: details.bankUsed || '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Firestore update plan error:', error);
  }
}

/**
 * Resets user back to free plan
 */
export async function resetToFreePlan(userId: string, userEmail?: string | null): Promise<void> {
  if (userEmail && isUserAdmin(userEmail)) {
    console.warn('Admin account cannot be downgraded to free tier.');
    return;
  }
  const localKey = `${LOCAL_PLAN_PREFIX}${userId}`;
  const subData: UserSubscription = {
    plan: 'free',
    extraSlots: 0,
    maxCredentialSlots: FREE_CREDENTIAL_SLOTS,
    paymentStatus: 'none',
    isExpired: true,
  };

  try {
    localStorage.setItem(localKey, JSON.stringify(subData));
  } catch (e) {}

  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      plan: 'free',
      planDuration: null,
      extraSlots: 0,
      maxCredentialSlots: FREE_CREDENTIAL_SLOTS,
      paymentStatus: 'none',
      isExpired: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Firestore reset plan error:', error);
  }
}

/**
 * Allows the administrator to approve a user's subscription and initiate the countdown!
 */
export async function approveUserSubscriptionByAdmin(
  targetUserId: string,
  planDuration: PlanDuration = 'biweekly'
): Promise<{ expiresAt: number; plan: PlanOption }> {
  const plan = getPlanOption(planDuration);
  const now = Date.now();
  const expiresAt = now + plan.durationDays * 86400 * 1000;

  const userDocRef = doc(db, 'users', targetUserId);
  await updateDoc(userDocRef, {
    plan: planDuration === 'yearly' ? 'yearly' : 'paid',
    planDuration,
    extraSlots: plan.additionalSlots,
    maxCredentialSlots: plan.totalSlots,
    approvedAt: now,
    expiresAt,
    isExpired: false,
    paymentStatus: 'verified',
    paymentRef: `ADMIN-APPROVED-${planDuration.toUpperCase()}`,
    paymentCurrency: 'NGN',
    updatedAt: serverTimestamp(),
  });

  return { expiresAt, plan };
}

/**
 * Extends an existing user's subscription countdown by a specified number of days
 */
export async function extendUserSubscriptionCountdown(
  targetUserId: string,
  currentExpiresAt: number | undefined,
  additionalDays: number
): Promise<number> {
  const baseTime = currentExpiresAt && currentExpiresAt > Date.now() ? currentExpiresAt : Date.now();
  const newExpiresAt = baseTime + additionalDays * 86400 * 1000;

  const userDocRef = doc(db, 'users', targetUserId);
  await updateDoc(userDocRef, {
    expiresAt: newExpiresAt,
    isExpired: false,
    updatedAt: serverTimestamp(),
  });

  return newExpiresAt;
}

/**
 * Immediately expires the subscription countdown for testing or manual revocation
 */
export async function expireUserSubscriptionNow(targetUserId: string): Promise<void> {
  const userDocRef = doc(db, 'users', targetUserId);
  await updateDoc(userDocRef, {
    expiresAt: Date.now() - 1000,
    isExpired: true,
    extraSlots: 0,
    maxCredentialSlots: FREE_CREDENTIAL_SLOTS,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Backwards compatible admin plan update
 */
export async function updateUserPlanByAdmin(
  targetUserId: string,
  newPlan: 'free' | 'paid' | 'unlimited' | 'biweekly' | 'monthly' | 'yearly',
  duration?: PlanDuration
): Promise<void> {
  if (newPlan === 'free') {
    await resetToFreePlan(targetUserId);
    return;
  }
  const chosenDuration = duration || (newPlan === 'monthly' ? 'monthly' : newPlan === 'yearly' ? 'yearly' : 'biweekly');
  await approveUserSubscriptionByAdmin(targetUserId, chosenDuration);
}

/**
 * Grants unlimited credential slots (unrestricted VIP/owner tier)
 */
export async function grantUnlimitedSlots(userId: string): Promise<void> {
  const localKey = `${LOCAL_PLAN_PREFIX}${userId}`;
  const subData: UserSubscription = {
    plan: 'unlimited',
    extraSlots: UNLIMITED_CREDENTIAL_SLOTS,
    maxCredentialSlots: UNLIMITED_CREDENTIAL_SLOTS,
    isUnlimited: true,
    paymentStatus: 'verified',
    paymentRef: 'VIP-UNRESTRICTED',
    paymentCurrency: 'NGN',
  };

  try {
    localStorage.setItem(localKey, JSON.stringify(subData));
  } catch (e) {}

  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      plan: 'unlimited',
      planDuration: 'yearly',
      extraSlots: UNLIMITED_CREDENTIAL_SLOTS,
      maxCredentialSlots: UNLIMITED_CREDENTIAL_SLOTS,
      paymentStatus: 'verified',
      expiresAt: null, // unlimited permanent
      isExpired: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Firestore grant unlimited error:', error);
  }
}
