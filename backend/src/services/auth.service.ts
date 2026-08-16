import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";

import {
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
} from "../utils/token.js";

const REFRESH_TOKEN_DAYS = 30;

function createStatusError(
  message: string,
  statusCode: number
) {
  const error = new Error(message);
  (error as any).statusCode = statusCode;
  return error;
}

export default class AuthService {
  constructor(
    private readonly app: FastifyInstance
  ) {}

  private async createTokens(user: any) {
    const accessToken = this.app.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      merchantId: user.merchantId ?? undefined,
    });

    const refreshToken = generateRefreshToken();

    const hashedToken =
      await hashRefreshToken(refreshToken);

    const expiresAt = new Date();

    expiresAt.setDate(
      expiresAt.getDate() + REFRESH_TOKEN_DAYS
    );

    await this.app.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private removeSensitiveUserFields(user: any) {
    if (!user) {
      return null;
    }

    const {
      passwordHash: _passwordHash,
      passwordResetToken: _passwordResetToken,
      passwordResetExpires: _passwordResetExpires,
      emailVerifyToken: _emailVerifyToken,
      emailVerifyExpires: _emailVerifyExpires,
      mfaSecret: _mfaSecret,
      backupCodes: _backupCodes,
      ...safeUser
    } = user;

    return safeUser;
  }

  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    merchantId?: string;
  }) {
    const email =
      data.email.trim().toLowerCase();

    const firstName =
      data.firstName.trim();

    const lastName =
      data.lastName.trim();

    if (!firstName) {
      throw createStatusError(
        "First name is required.",
        400
      );
    }

    if (!lastName) {
      throw createStatusError(
        "Last name is required.",
        400
      );
    }

    if (!email) {
      throw createStatusError(
        "Email is required.",
        400
      );
    }

    if (!data.password) {
      throw createStatusError(
        "Password is required.",
        400
      );
    }

    const existing =
      await this.app.prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (existing) {
      throw createStatusError(
        "Email already exists.",
        409
      );
    }

    let merchantId:
      | string
      | undefined;

    if (data.merchantId?.trim()) {
      merchantId =
        data.merchantId.trim();

      const merchant =
        await this.app.prisma.merchant.findUnique({
          where: {
            id: merchantId,
          },
        });

      if (!merchant) {
        throw createStatusError(
          "Merchant account not found.",
          404
        );
      }
    }

    const passwordHash =
      await bcrypt.hash(
        data.password,
        12
      );

    const user =
      await this.app.prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          passwordHash,
          role: "VIEWER",
          ...(merchantId
            ? {
                merchantId,
              }
            : {}),
        },
      });

    const tokens =
      await this.createTokens(user);

    return {
      ...tokens,
      user:
        this.removeSensitiveUserFields(
          user
        ),
    };
  }

  async login(
    email: string,
    password: string
  ) {
    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw createStatusError(
        "Email is required.",
        400
      );
    }

    if (!password) {
      throw createStatusError(
        "Password is required.",
        400
      );
    }

    const user =
      await this.app.prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (!user?.passwordHash) {
      throw createStatusError(
        "Invalid credentials.",
        401
      );
    }

    const valid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!valid) {
      throw createStatusError(
        "Invalid credentials.",
        401
      );
    }

    const tokens =
      await this.createTokens(user);

    return {
      ...tokens,
      user:
        this.removeSensitiveUserFields(
          user
        ),
    };
  }

  async refresh(
    refreshToken: string
  ) {
    if (!refreshToken?.trim()) {
      throw createStatusError(
        "Refresh token is required.",
        400
      );
    }

    const records =
      await this.app.prisma.refreshToken.findMany({
        where: {
          revoked: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: true,
        },
      });

    let record: any = null;

    for (const item of records) {
      const ok =
        await verifyRefreshToken(
          refreshToken,
          item.token
        );

      if (ok) {
        record = item;
        break;
      }
    }

    if (!record) {
      throw createStatusError(
        "Invalid refresh token.",
        401
      );
    }

    await this.app.prisma.refreshToken.update({
      where: {
        id: record.id,
      },
      data: {
        revoked: true,
      },
    });

    return this.createTokens(
      record.user
    );
  }

  async logout(
    refreshToken: string
  ) {
    if (!refreshToken?.trim()) {
      throw createStatusError(
        "Refresh token is required.",
        400
      );
    }

    const records =
      await this.app.prisma.refreshToken.findMany({
        where: {
          revoked: false,
        },
      });

    for (const item of records) {
      const ok =
        await verifyRefreshToken(
          refreshToken,
          item.token
        );

      if (ok) {
        await this.app.prisma.refreshToken.update({
          where: {
            id: item.id,
          },
          data: {
            revoked: true,
          },
        });

        return;
      }
    }

    throw createStatusError(
      "Invalid refresh token.",
      401
    );
  }

  async me(
    userId: string
  ) {
    if (!userId?.trim()) {
      throw createStatusError(
        "User ID is required.",
        400
      );
    }

    const user =
      await this.app.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      throw createStatusError(
        "User not found.",
        404
      );
    }

    return this.removeSensitiveUserFields(
      user
    );
  }
}