import app from "../../src/app";

describe("Health Endpoint", () => {
  it("returns 200", async () => {
    const server = await app();

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
  });
});