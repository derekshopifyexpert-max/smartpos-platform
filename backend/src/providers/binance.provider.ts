import axios, {
  AxiosInstance
} from "axios";
import crypto from "crypto";
import BaseProvider, {
  CreatePaymentInput,
  RefundPaymentInput,
  VerifyPaymentInput,
  ProviderResponse
} from "./base.provider.js";

export default class BinanceProvider extends BaseProvider {
  readonly name = "binance";
  private readonly client: AxiosInstance;
  constructor(
    private readonly apiKey: string,
    private readonly secretKey: string
  ) {
    super();
    this.client = axios.create({
      baseURL:
        "https://bpay.binanceapi.com",
      headers: {
        "Content-Type":
          "application/json"
      }
    });
  }
  private sign(
    payload: string
  ) {
    return crypto
      .createHmac(
        "sha512",
        this.secretKey
      )
      .update(payload)
      .digest("hex");
  }
  async createPayment(
    input: CreatePaymentInput
  ): Promise<ProviderResponse> {
    const payload = {
      merchantTradeNo:
        input.reference,
      orderAmount:
        input.amount,
      currency:
        input.currency,
      goods: {
        goodsType:
          "01",
        goodsCategory:
          "D000",
        referenceGoodsId:
          input.reference,
        goodsName:
          input.description ||
          "Payment"
      }
    };
    const timestamp =
      Date.now();
    const nonce =
      crypto.randomUUID();
    const signature =
      this.sign(
        `${timestamp}\n${nonce}\n${JSON.stringify(payload)}\n`
      );
    const response =
      await this.client.post(
        "/binancepay/openapi/v2/order",
        payload,
        {
          headers: {
            "BinancePay-Timestamp":
              timestamp,
            "BinancePay-Nonce":
              nonce,
            "BinancePay-Certificate-SN":
              this.apiKey,
            "BinancePay-Signature":
              signature
          }
        }
      );
    return {
      success:
        response.data.status ===
        "SUCCESS",
      message:
        response.data.code,
      reference:
        input.reference,
      transactionId:
        response.data.data?.prepayId,
      raw:
        response.data
    };
  }
  async verifyPayment(
    input: VerifyPaymentInput
  ): Promise<ProviderResponse> {
    const payload = {
      prepayId:
        input.transactionId
    };
    const timestamp =
      Date.now();
    const nonce =
      crypto.randomUUID();
    const signature =
      this.sign(
        `${timestamp}\n${nonce}\n${JSON.stringify(payload)}\n`
      );
    const response =
      await this.client.post(
        "/binancepay/openapi/order/query",
        payload,
        {
          headers: {
            "BinancePay-Timestamp":
              timestamp,
            "BinancePay-Nonce":
              nonce,
            "BinancePay-Certificate-SN":
              this.apiKey,
            "BinancePay-Signature":
              signature
          }
        }
      );
    return {
      success:
        response.data.status ===
        "SUCCESS",
      message:
        response.data.code,
      transactionId:
        input.transactionId,
      raw:
        response.data
    };
  }
  async chargeWithAuthorization(
    input: {
      amount: number;
      currency: string;
      email: string;
      authorizationCode: string;
      reference: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ProviderResponse> {
    throw new Error("Binance authorization charging is not supported in this backend integration.");
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<ProviderResponse> {
    return {
      success: false,
      message:
        "Binance Pay refunds require merchant refund workflow.",
      transactionId:
        input.transactionId
    };
  }
  async validateWebhook(
    payload: any,
    signature: string
  ): Promise<boolean> {
    const expected =
      this.sign(
        JSON.stringify(payload)
      );
    return expected === signature;
  }
}