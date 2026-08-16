export interface AuthenticatedUser {
  sub?: string;
  id?: string;
  userId?: string;

  email?: string;

  merchantId?: string | null;

  role?: string | null;

  [key: string]: unknown;
}