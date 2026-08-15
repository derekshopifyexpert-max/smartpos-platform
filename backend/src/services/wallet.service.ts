import {
FastifyInstance,
} from "fastify";

import {
Prisma,
} from "@prisma/client";

type WalletDatabase =
| Prisma.TransactionClient
| FastifyInstance["prisma"];

export default class WalletService {
constructor(
private readonly app: FastifyInstance
) {}

private async ensureBlockchainNetwork(
networkName: string,
db: WalletDatabase
) {
const normalized =
networkName
.trim()
.toUpperCase();
const existing =
  await db.blockchainNetwork.findUnique({
    where: {
      name:
        normalized as any,
    },
  });

if (existing) {
  return existing;
}

return db.blockchainNetwork.create({
  data: {
    name:
      normalized as any,

    nativeCurrency:
      "USD",

    blockTime:
      12,

    isActive:
      true,

    metadata: {
      source:
        "smartpos-wallet-creation",

      autoCreated:
        true,
    },
  },
});

}

private validateAddress(
networkName: string,
address: string
) {
const network =
networkName
.trim()
.toUpperCase();

const normalizedAddress =
  address.trim();

if (!normalizedAddress) {
  throw new Error(
    "Wallet address is required."
  );
}

/*
 * SmartPOS stores an existing public
 * settlement address.
 *
 * Ethereum and BSC currently use
 * EVM-compatible public addresses.
 */
if (
  network === "ETHEREUM" ||
  network === "BSC"
) {
  if (
    !/^0x[a-fA-F0-9]{40}$/.test(
      normalizedAddress
    )
  ) {
    throw new Error(
      `Invalid ${network} wallet address. Enter a valid EVM public address beginning with 0x.`
    );
  }
}

/*
 * Do not pretend that an EVM address
 * is a TRON address.
 */
if (
  network === "TRON"
) {
  throw new Error(
    "TRON wallet addresses are not currently supported by SmartPOS."
  );
}

if (
  network !== "ETHEREUM" &&
  network !== "BSC"
) {
  throw new Error(
    `Unsupported blockchain network: ${network}.`
  );
}

return normalizedAddress;

}

private async createWalletRecord(
data: {
merchantId: string;
name: string;
currency: string;
blockchain: string;
network: string;
asset: string;
address: string;
type?: string;
metadata?: Record<
string,
unknown
>;
},
db: WalletDatabase
) {
const merchant =
await db.merchant.findUnique({
where: {
id:
data.merchantId,
},
});

if (!merchant) {
  throw new Error(
    "Merchant not found."
  );
}

const networkName =
  data.network
    .trim()
    .toUpperCase();

const blockchainName =
  data.blockchain
    .trim()
    .toUpperCase();

if (
  networkName !==
  blockchainName
) {
  throw new Error(
    "Blockchain and network must refer to the same network."
  );
}

const assetSymbol =
  data.asset
    .trim()
    .toUpperCase();

const walletAddress =
  this.validateAddress(
    networkName,
    data.address
  );

const blockchain =
  await this.ensureBlockchainNetwork(
    networkName,
    db
  );

/*
 * Never allow the same public address
 * to be registered twice.
 */
const existingAddress =
  await db.walletAddress.findUnique({
    where: {
      address:
        walletAddress,
    },

    include: {
      wallet: true,
    },
  });

if (existingAddress) {
  if (
    existingAddress.wallet
      .merchantId ===
    data.merchantId
  ) {
    throw new Error(
      "This wallet address is already saved for this merchant."
    );
  }

  throw new Error(
    "This wallet address is already associated with another merchant."
  );
}

/*
 * IMPORTANT:
 *
 * SmartPOS does NOT generate this wallet.
 *
 * The merchant already owns the wallet
 * externally. SmartPOS only stores the
 * public settlement address so payments
 * can be directed to it.
 */
const wallet =
  await db.wallet.create({
    data: {
      merchantId:
        data.merchantId,

      name:
        data.name.trim(),

      type:
        (data.type ??
          "CRYPTO") as any,

      currency:
        data.currency
          .trim()
          .toUpperCase() as any,

      balance:
        new Prisma.Decimal(0),

      availableBalance:
        new Prisma.Decimal(0),

      reservedBalance:
        new Prisma.Decimal(0),

      /*
       * This is the merchant's existing
       * public settlement address.
       */
      address:
        walletAddress,

      blockchainId:
        blockchain.id,

      /*
       * SmartPOS does not custody the wallet.
       */
      encryptedPrivateKey:
        null,

      publicKey:
        null,

      metadata: {
        ...(data.metadata ??
          {}),

        asset:
          assetSymbol,

        network:
          networkName,

        walletGenerated:
          false,

        walletType:
          "EXTERNAL_SETTLEMENT",

        purpose:
          "crypto-settlement",

        custody:
          "merchant-controlled",
      },
    },
  });

/*
 * The wallet and its primary address are
 * created using the same database client.
 *
 * When createWallet() calls this method
 * inside a Prisma transaction, failure here
 * automatically rolls the wallet creation
 * back.
 */
await db.walletAddress.create({
  data: {
    walletId:
      wallet.id,

    address:
      walletAddress,

    blockchainId:
      blockchain.id,

    label:
      "Primary",

    isActive:
      true,

    metadata: {
      asset:
        assetSymbol,

      network:
        networkName,

      source:
        "merchant-settlement-wallet",
    },
  },
});

return db.wallet.findUnique({
  where: {
    id:
      wallet.id,
  },

  include: {
    blockchain:
      true,

    walletAddresses:
      true,
  },
});

}

async createWallet(
data: {
merchantId: string;
name: string;
currency: string;
blockchain: string;
network: string;
asset: string;
address: string;
type?: string;
metadata?: Record<
string,
unknown
>;
}
) {
if (
!data.merchantId?.trim()
) {
throw new Error(
"Merchant account is required."
);
}

if (
  !data.name?.trim()
) {
  throw new Error(
    "Wallet name is required."
  );
}

if (
  !data.address?.trim()
) {
  throw new Error(
    "Wallet address is required."
  );
}

/*
 * Wallet record + primary wallet address
 * must be atomic.
 */
return this.app.prisma.$transaction(
  async (tx) => {
    return this.createWalletRecord(
      data,
      tx
    );
  }
);

}

async getWallet(
id: string
) {
return this.app.prisma.wallet.findUnique({
where: {
id,
},

  include: {
    blockchain:
      true,

    walletAddresses:
      true,
  },
});

}

async getWalletForMerchant(
walletId: string,
merchantId?: string
) {
if (
!merchantId?.trim()
) {
throw new Error(
"Merchant account is required."
);
}

const wallet =
  await this.app.prisma.wallet.findFirst({
    where: {
      id:
        walletId,

      merchantId:
        merchantId.trim(),
    },

    include: {
      blockchain:
        true,

      walletAddresses:
        true,
    },
  });

if (!wallet) {
  throw new Error(
    "Wallet not found."
  );
}

return wallet;

}

async merchantWallets(
merchantId: string
) {
if (
!merchantId?.trim()
) {
throw new Error(
"Merchant account is required."
);
}

return this.app.prisma.wallet.findMany({
  where: {
    merchantId:
      merchantId.trim(),
  },

  include: {
    blockchain:
      true,

    walletAddresses:
      true,
  },

  orderBy: {
    createdAt:
      "desc",
  },
});

}

async creditWallet(
walletId: string,
amount: Prisma.Decimal
) {
if (
amount.lessThanOrEqualTo(0)
) {
throw new Error(
"Credit amount must be greater than zero."
);
}

const wallet =
  await this.getWallet(
    walletId
  );

if (!wallet) {
  throw new Error(
    "Wallet not found."
  );
}

const balance =
  new Prisma.Decimal(
    wallet.balance
  );

const newBalance =
  balance.plus(
    amount
  );

return this.app.prisma.wallet.update({
  where: {
    id:
      walletId,
  },

  data: {
    balance:
      newBalance,

    availableBalance:
      newBalance,
  },
});

}

async debitWallet(
walletId: string,
amount: Prisma.Decimal
) {
if (
amount.lessThanOrEqualTo(0)
) {
throw new Error(
"Debit amount must be greater than zero."
);
}

const wallet =
  await this.getWallet(
    walletId
  );

if (!wallet) {
  throw new Error(
    "Wallet not found."
  );
}

const balance =
  new Prisma.Decimal(
    wallet.balance
  );

if (
  balance.lessThan(
    amount
  )
) {
  throw new Error(
    "Insufficient wallet balance."
  );
}

const newBalance =
  balance.minus(
    amount
  );

return this.app.prisma.wallet.update({
  where: {
    id:
      walletId,
  },

  data: {
    balance:
      newBalance,

    availableBalance:
      newBalance,
  },
});

}

async transferFunds(
fromWalletId: string,
toWalletId: string,
amount: Prisma.Decimal
) {
if (
amount.lessThanOrEqualTo(0)
) {
throw new Error(
"Transfer amount must be greater than zero."
);
}

return this.app.prisma.$transaction(
  async (tx) => {
    const fromWallet =
      await tx.wallet.findUnique({
        where: {
          id:
            fromWalletId,
        },
      });

    if (!fromWallet) {
      throw new Error(
        "Source wallet not found."
      );
    }

    const toWallet =
      await tx.wallet.findUnique({
        where: {
          id:
            toWalletId,
        },
      });

    if (!toWallet) {
      throw new Error(
        "Destination wallet not found."
      );
    }

    const fromBalance =
      new Prisma.Decimal(
        fromWallet.balance
      );

    if (
      fromBalance.lessThan(
        amount
      )
    ) {
      throw new Error(
        "Insufficient wallet balance."
      );
    }

    const newFromBalance =
      fromBalance.minus(
        amount
      );

    const toBalance =
      new Prisma.Decimal(
        toWallet.balance
      );

    const newToBalance =
      toBalance.plus(
        amount
      );

    await tx.wallet.update({
      where: {
        id:
          fromWalletId,
      },

      data: {
        balance:
          newFromBalance,

        availableBalance:
          newFromBalance,
      },
    });

    await tx.wallet.update({
      where: {
        id:
          toWalletId,
      },

      data: {
        balance:
          newToBalance,

        availableBalance:
          newToBalance,
      },
    });

    return {
      fromWalletId,
      toWalletId,
      amount,
      status:
        "SUCCESS",
    };
  }
);

}

async reserveFunds(
walletId: string,
amount: Prisma.Decimal
) {
if (
amount.lessThanOrEqualTo(0)
) {
throw new Error(
"Reserve amount must be greater than zero."
);
}

const wallet =
  await this.getWallet(
    walletId
  );

if (!wallet) {
  throw new Error(
    "Wallet not found."
  );
}

const availableBalance =
  new Prisma.Decimal(
    wallet.availableBalance
  );

const reservedBalance =
  new Prisma.Decimal(
    wallet.reservedBalance
  );

if (
  availableBalance.lessThan(
    amount
  )
) {
  throw new Error(
    "Insufficient available balance."
  );
}

return this.app.prisma.wallet.update({
  where: {
    id:
      walletId,
  },

  data: {
    availableBalance:
      availableBalance.minus(
        amount
      ),

    reservedBalance:
      reservedBalance.plus(
        amount
      ),
  },
});

}

async releaseFunds(
walletId: string,
amount: Prisma.Decimal
) {
if (
amount.lessThanOrEqualTo(0)
) {
throw new Error(
"Release amount must be greater than zero."
);
}


const wallet =
  await this.getWallet(
    walletId
  );

if (!wallet) {
  throw new Error(
    "Wallet not found."
  );
}

const availableBalance =
  new Prisma.Decimal(
    wallet.availableBalance
  );

const reservedBalance =
  new Prisma.Decimal(
    wallet.reservedBalance
  );

if (
  reservedBalance.lessThan(
    amount
  )
) {
  throw new Error(
    "Insufficient reserved balance."
  );
}

return this.app.prisma.wallet.update({
  where: {
    id:
      walletId,
  },

  data: {
    availableBalance:
      availableBalance.plus(
        amount
      ),

    reservedBalance:
      reservedBalance.minus(
        amount
      ),
  },
});

}

async captureFunds(
walletId: string,
amount: Prisma.Decimal
) {
if (
amount.lessThanOrEqualTo(0)
) {
throw new Error(
"Capture amount must be greater than zero."
);
}

const wallet =
  await this.getWallet(
    walletId
  );

if (!wallet) {
  throw new Error(
    "Wallet not found."
  );
}

const balance =
  new Prisma.Decimal(
    wallet.balance
  );

const reservedBalance =
  new Prisma.Decimal(
    wallet.reservedBalance
  );

const availableBalance =
  new Prisma.Decimal(
    wallet.availableBalance
  );

if (
  reservedBalance.lessThan(
    amount
  )
) {
  throw new Error(
    "Insufficient reserved balance."
  );
}

if (
  balance.lessThan(
    amount
  )
) {
  throw new Error(
    "Insufficient wallet balance."
  );
}

return this.app.prisma.wallet.update({
  where: {
    id:
      walletId,
  },

  data: {
    balance:
      balance.minus(
        amount
      ),

    reservedBalance:
      reservedBalance.minus(
        amount
      ),

    availableBalance:
      availableBalance,
  },
});


}
}