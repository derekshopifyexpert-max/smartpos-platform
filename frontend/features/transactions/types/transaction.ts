export interface TransactionMerchant {
  id: string;
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  businessType?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface TransactionTerminal {
  id: string;
  serialNumber?: string | null;
  status?: string | null;
  name?: string | null;
}

export interface TransactionCustomer {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
}

export interface GatewayResponseBody {
  approved?: boolean;
  transactionId?: string | null;
  paymentUrl?: string | null;
  authorizationCode?: string | null;
}

export interface TransactionGatewayResponse {
  responseBody?: GatewayResponseBody | null;
}

export interface TransactionGatewayRequest {
  response?: TransactionGatewayResponse | null;
}

export interface Transaction {
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
  idempotencyKey?: string | null;
  description?: string | null;

  paymentMethod?: string | null;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  cardExpiry?: string | null;

  gatewayTransactionId?: string | null;
  gatewayProvider?: string | null;

  paymentUrl?: string | null;

  authorizationCode?: string | null;
  approvalCode?: string | null;
  authCode?: string | null;

  settlementStatus?: string | null;
  settlementAmount?: number | string | null;
  settlementCurrency?: string | null;
  settlementDate?: string | null;

  feeAmount?: number | string | null;
  feeCurrency?: string | null;
  netAmount?: number | string | null;

  paymentIntentId?: string | null;

  createdAt: string;
  updatedAt?: string | null;

  merchant?: TransactionMerchant | null;
  terminal?: TransactionTerminal | null;
  customer?: TransactionCustomer | null;

  gatewayRequest?: TransactionGatewayRequest | null;
}

export interface TransactionListResponse {
  success: boolean;

  data: {
    items: Transaction[];

    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}