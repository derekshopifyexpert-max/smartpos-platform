// Crypto Conversion - Tracks fiat -> crypto settlement
export interface CryptoConversion {
  id: string;
  paymentIntentId: string;
  merchantId: string;
  
  // Amounts
  fromCurrency: string;
  fromAmount: string;
  toCurrency: string;
  toAmount: string; // Actual acquired amount
  
  // Exchange tracking
  exchangeOrderId?: string;
  exchangeProvider?: string;
  
  // Blockchain tracking
  blockchainTransactionId?: string;
  txHash?: string;
  
  // Status progression
  status: "pending" | "exchange_completed" | "blockchain_broadcast" | "completed" | "failed";
  failureReason?: string;
  
  // Metadata
  metadata?: {
    quoteId?: string;
    clientOrderId?: string;
    actualExecutedAmount?: string;
    requestedAmount?: string;
    blockchainTransactionId?: string;
    txHash?: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

// Blockchain Transaction - For settlement tracking
export interface BlockchainTransaction {
  id: string;
  
  // Transaction details
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  
  // Blockchain details
  chainId: number;
  blockNumber?: number;
  blockHash?: string;
  confirmations: number;
  
  // Token details
  tokenSymbol: string;
  contractAddress: string;
  
  // Status
  status: "pending" | "broadcasted" | "confirming" | "confirmed" | "reverted" | "failed";
  
  // Metadata
  metadata?: {
    requiredConfirmations?: number;
    actualFee?: string;
    gasUsed?: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

// Settlement Status - Combined view
export interface SettlementStatus {
  conversion: CryptoConversion;
  blockchainTransaction?: BlockchainTransaction;
  confirmations?: number;
  progress: SettlementProgress;
}

export interface SettlementProgress {
  stage: "payment_pending" | "quote_obtained" | "exchange_filled" | "blockchain_broadcast" | "confirming" | "settled" | "failed";
  message: string;
  completed: number;
  total: number;
}
