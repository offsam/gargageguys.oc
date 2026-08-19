import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSeniorTechnician, resolveTechRank } from "./tech-rank";

describe("tech rank", () => {
  it("marks Sam as senior technician", () => {
    assert.equal(
      resolveTechRank({ role: "technician", email: "artemovsam@gmail.com" }),
      "senior",
    );
    assert.equal(
      isSeniorTechnician({ role: "technician", email: "artemovsam@gmail.com" }),
      true,
    );
  });

  it("keeps other techs regular unless stored as senior", () => {
    assert.equal(
      resolveTechRank({ role: "technician", email: "tech@garageguysoc.com" }),
      "technician",
    );
    assert.equal(
      resolveTechRank({
        role: "technician",
        email: "tech@garageguysoc.com",
        storedRank: "senior",
      }),
      "senior",
    );
  });
});
