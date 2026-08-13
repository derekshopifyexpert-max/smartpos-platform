import request from "supertest";

import buildApp from "../../src/app";

describe("Authentication", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should reject invalid credentials", async () => {
    const response = await request(app.server)
      .post("/api/auth/login")
      .send({
        email: "invalid@test.com",
        password: "wrong",
      });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
