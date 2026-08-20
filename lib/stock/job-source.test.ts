import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jobCompanyLabel } from "./job-source";

describe("jobCompanyLabel", () => {
  it("shows Garage Guys for own work", () => {
    assert.equal(jobCompanyLabel("Garage Guys", ""), "Garage Guys");
    assert.equal(jobCompanyLabel("", "Champion"), "Garage Guys");
  });

  it("shows partner company for partner jobs", () => {
    assert.equal(
      jobCompanyLabel("Partner", "Champion Garage Doors Service"),
      "Champion Garage Doors Service",
    );
  });
});
