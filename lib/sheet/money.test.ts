import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyServicePriceToJobCost,
  bankFeeFor,
  clearProfitFor,
  effectiveTechPay,
  partnerTechSalary,
  parseMoney,
} from "./money.ts";

describe("parseMoney / partner tech salary", () => {
  it("parses currency-ish strings", () => {
    assert.equal(parseMoney("$1,250.50"), 1250.5);
    assert.equal(parseMoney(""), 0);
  });

  it("uses 30% partner tech rate", () => {
    assert.equal(partnerTechSalary("1000"), "300.00");
    assert.equal(partnerTechSalary("0"), "");
    assert.equal(partnerTechSalary(""), "");
  });

  it("computes bank fee at 3.5%", () => {
    assert.equal(bankFeeFor("1000"), "35.00");
  });
});

describe("clearProfitFor", () => {
  const partners = [
    { name: "Champion", hasOwnStock: false },
    { name: "Own Stock Co", hasOwnStock: true },
  ];

  it("partner without own stock = gross - tech - parts", () => {
    const profit = clearProfitFor(
      {
        workSource: "Partner",
        partnerName: "Champion",
        jobCost: "1000",
        techSalary: "300",
        partsCost: "50",
      },
      partners,
    );
    assert.match(profit, /\$650\.00/);
  });

  it("partner with own stock clears to $0", () => {
    const profit = clearProfitFor(
      {
        workSource: "Partner",
        partnerName: "Own Stock Co",
        jobCost: "1000",
        techSalary: "300",
        partsCost: "50",
      },
      partners,
    );
    assert.match(profit, /\$0\.00/);
  });

  it("garage guys subtracts lead, bank fee, parts, tech", () => {
    const profit = clearProfitFor(
      {
        workSource: "Garage Guys",
        partnerName: "",
        jobCost: "1000",
        leadCost: "100",
        bankFee: "35",
        partsCost: "50",
        techSalary: "300",
      },
      partners,
    );
    assert.match(profit, /\$515\.00/);
  });
});

describe("effectiveTechPay", () => {
  it("auto-fills partner 30% when salary blank", () => {
    assert.equal(
      effectiveTechPay({
        workSource: "Partner",
        partnerName: "Champion",
        jobCost: "1000",
        techSalary: "",
        partsCost: "",
      }),
      300,
    );
  });

  it("prefers explicit salary", () => {
    assert.equal(
      effectiveTechPay({
        workSource: "Partner",
        partnerName: "Champion",
        jobCost: "1000",
        techSalary: "250",
        partsCost: "",
      }),
      250,
    );
  });
});

describe("applyServicePriceToJobCost", () => {
  const prices = new Map<string, number>([
    ["tune-up / lubrication", 99],
    ["cable replacement", 189],
  ]);

  it("fills empty job cost from catalog price", () => {
    assert.equal(
      applyServicePriceToJobCost("", "", "Tune-up / lubrication", prices),
      "99.00",
    );
  });

  it("replaces auto-filled previous service price", () => {
    assert.equal(
      applyServicePriceToJobCost("99.00", "Tune-up / lubrication", "Cable replacement", prices),
      "189.00",
    );
  });

  it("leaves a manually typed job cost alone", () => {
    assert.equal(
      applyServicePriceToJobCost("450", "Tune-up / lubrication", "Cable replacement", prices),
      "450",
    );
  });
});
