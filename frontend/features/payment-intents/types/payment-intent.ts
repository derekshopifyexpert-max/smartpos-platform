export interface PaymentIntentMerchant {
  id: string;
  name: string;
  legalName?: string | null;
  businessType?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  timezone?: string | null;
  currency?: string | null;
  status?: string | null;
  description?: string | null;
  logo?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentIntentCustomer {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface PaymentAttempt {
  id: string;
  status?: string | null;
  createdAt?: string | null;
}

export interface PaymentIntentTransaction {
  id: string;
  merchantId?: string | null;
  terminalId?: string | null;
  customerId?: string | null;
  walletId?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  type?: string | null;
  reference?: string | null;
  description?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PaymentIntent {
  id: string;
  merchantId?: string | null;
  customerId?: string | null;
  paymentMethodId?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  description?: string | null;
  clientSecret?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt?: string | null;
  expiresAt?: string | null;
  merchant?: PaymentIntentMerchant | null;
  customer?: PaymentIntentCustomer | null;
  paymentAttempts?: PaymentAttempt[];
  transactions?: PaymentIntentTransaction[];
}

export interface PaymentIntentResponse {
  success: boolean;
  data: {
    items: PaymentIntent[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface PaymentIntentDetailResponse {
  success: boolean;
  data: PaymentIntent;
}

export interface PaymentIntentAuthorization {
  id: string;
  transactionId: string;
  authorizationCode?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  message?: string | null;
  gatewayResponse?: unknown;
  authorizedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  transaction?: PaymentIntentTransaction | null;
}

export interface CustomerPaymentMethod {
  id: string;
  type: "card";
  label: string;
  brand: string | null;
  last4: string | null;
  isReusable: boolean;
  status?: string | null;
  createdAt?: string | null;
}

export interface PaymentGatewayResponse {
  transactionId: string | null;
  paymentUrl: string | null;
  accessCode: string | null;
  authorizationCode: string | null;
}

export interface CheckoutPaymentIntentResponse {
  paymentIntent: PaymentIntent;
  transaction: PaymentIntentTransaction;
  paymentAttempt: PaymentAttempt;
  provider: string;
  gateway: PaymentGatewayResponse;
  response?: unknown;
}

export interface PaymentIntentAuthorizationsResponse {
  success: boolean;
  data: {
    paymentIntent: PaymentIntent;
    authorizations: PaymentIntentAuthorization[];
  };
}

export interface CustomerPaymentMethodsResponse {
  success: boolean;
  data: CustomerPaymentMethod[];
}

export interface ChargeSavedAuthorizationResponse {
  paymentIntent: PaymentIntent;
  transaction: PaymentIntentTransaction;
  paymentAttempt: PaymentAttempt;
  authorization: PaymentIntentAuthorization;
  provider: string;
  gateway: PaymentGatewayResponse;
  response?: unknown;
  duplicate?: boolean;
}