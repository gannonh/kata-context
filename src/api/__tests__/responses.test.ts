import { describe, expect, it } from "vitest";
import { successResponse } from "../responses.js";

describe("successResponse", () => {
  it("returns correct status code", () => {
    const res = successResponse(201, { id: "abc" });
    expect(res.status).toBe(201);
  });

  it("returns JSON body matching input", async () => {
    const data = { data: [1, 2, 3], nextCursor: 10 };
    const res = successResponse(200, data);
    const body = await res.json();
    expect(body).toEqual(data);
  });
});
