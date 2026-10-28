export type VaultItemType = 'credential' | 'document';

export type VaultCategory =
  | 'social'
  | 'work'
  | 'personal'
  | 'finance'
  | 'document'
  | 'other';

export interface VaultItem {
  id: string;
  userId: string;
  type: VaultItemType;
  title: string;
  service?: string; // e.g. "Google", "Facebook", "GitHub", "AWS"
  username?: string;
  password?: string;
  url?: string;
  category: VaultCategory;
  notes?: string;
  imageUrl?: string;
  imageName?: string;
  imageSize?: number;
  imageType?: string;
  favorite?: boolean;
  createdAt: any;
  updatedAt: any;
}

export type PlanDuration = 'biweekly' | 'monthly' | 'yearly';

export type UserPlanTier = 'free' | 'paid' | 'unlimited' | 'biweekly' | 'monthly' | 'yearly';

export interface PlanOption {
  id: PlanDuration;
  name: string;
  priceNGN: number;
  formattedPrice: string;
  durationDays: number;
  durationLabel: string;
  additionalSlots: number;
  totalSlots: number;
  isUnlimited?: boolean;
  description: string;
  popular?: boolean;
}

export interface UserAccount {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  plan?: UserPlanTier;
  planDuration?: PlanDuration;
  extraSlots?: number;
  maxCredentialSlots?: number;
  approvedAt?: number;
  expiresAt?: number;
  isExpired?: boolean;
  isBanned?: boolean;
  bannedReason?: string;
  bannedAt?: any;
  bannedBy?: string;
  createdAt: any;
  updatedAt: any;
}

export type VaultViewMode = 'all' | 'credentials' | 'documents' | 'favorites' | 'admin' | 'admin-chat' | 'payment' | 'support';

export interface UserSubscription {
  plan: UserPlanTier;
  planDuration?: PlanDuration;
  extraSlots: number; // 0 for free, 20 for biweekly, 40 for monthly, 999999 for yearly
  maxCredentialSlots: number; // 10 for free, 30 for biweekly, 50 for monthly, Infinity for yearly
  isUnlimited?: boolean;
  paymentStatus?: 'none' | 'pending' | 'verified';
  paymentRef?: string;
  paymentCurrency?: 'NGN' | 'USD';
  senderName?: string;
  bankUsed?: string;
  paidAt?: any;
  approvedAt?: number;
  expiresAt?: number;
  isExpired?: boolean;
  isBanned?: boolean;
  bannedReason?: string;
}

export interface BankAccountDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  instructions: string;
  routingOrSortCode?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  type: 'suggestion' | 'complaint' | 'inquiry' | 'payment';
  subject: string;
  message: string;
  status: 'pending' | 'reviewed' | 'resolved';
  isRedirectedToOwner?: boolean;
  redirectedBy?: string;
  redirectedAt?: any;
  adminNotes?: string;
  createdAt: any;
}

export interface PaymentSubmissionLog {
  userId: string;
  userEmail: string;
  senderName: string;
  bankUsed: string;
  paymentRef: string;
  paymentCurrency: 'USD' | 'NGN';
  amount: number;
  confirmedWithin: string;
  status: 'pending' | 'verified';
  submittedAt: string;
}

/**
 * Granular permissions for appointed administrators.
 * Primary owner/super-admin has permanent full permissions.
 */
export interface AdminPermissions {
  // 1. Appointed admins ability to view only the UID or full information of registered users
  viewFullUserInfo: boolean; // false = only UID visible, email & name masked; true = full user info visible
  // 2. Ability to give slots
  giveSlots: boolean;
  // 3. Ability to answer complaints
  answerComplaints: boolean;
  // 4. Ability to redirect important suggestions to the primary admin
  redirectSuggestions: boolean;
  // 5. Appointed admins ability to view transactions
  viewTransactions: boolean;
  // 6. Appointed admins ability to ban suspicious users (unbanning is strictly superadmin role)
  banUsers: boolean;
  // 7. Ability to add admins
  addAdmins: boolean;
  // 8. Ability to receive transaction notices so as to check and notify the primary admin of a purchase
  receiveTransactionNotices: boolean;
}

export const DEFAULT_APPOINTED_ADMIN_PERMISSIONS: AdminPermissions = {
  viewFullUserInfo: false, // Default: view only UID
  giveSlots: true,
  answerComplaints: true,
  redirectSuggestions: true,
  viewTransactions: true,
  banUsers: true,
  addAdmins: false,
  receiveTransactionNotices: true,
};

export const SUPER_ADMIN_PERMISSIONS: AdminPermissions = {
  viewFullUserInfo: true,
  giveSlots: true,
  answerComplaints: true,
  redirectSuggestions: true,
  viewTransactions: true,
  banUsers: true,
  addAdmins: true,
  receiveTransactionNotices: true,
};

export interface AdminRecord {
  userId: string;
  email: string;
  displayName?: string;
  role: 'superadmin' | 'admin';
  addedBy?: string;
  addedAt: any;
  photoURL?: string;
  permissions?: AdminPermissions;
}
