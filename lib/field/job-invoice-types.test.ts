import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInvoiceLine,
  parseInvoiceLines,
  sumInvoiceDiscounts,
} from "./job-invoice-types";

describe("buildInvoiceLine", () => {
  it("records discount when price is lowered", () => {
    const line = buildInvoiceLine({
      id: "1",
      kind: "service",
      name: "Spring",
      qty: 2,
      listCents: 20000,
      unitCents: 15000,
    });
    assert.equal(line.discountCents, 10000);
    assert.equal(line.totalCents, 30000);
    assert.equal(line.listCents, 20000);
  });

  it("raises price with no discount", () => {
    const line = buildInvoiceLine({
      id: "1",
      kind: "part",
      name: "Atom",
      qty: 1,
      listCents: 5000,
      unitCents: 7500,
    });
    assert.equal(line.discountCents, 0);
    assert.equal(line.totalCents, 7500);
  });
});

describe("parseInvoiceLines", () => {
  it("backfills list/discount on legacy lines", () => {
    const [line] = parseInvoiceLines([
      { id: "a", kind: "part", name: "Rail", qty: 1, unitCents: 1000, totalCents: 1000 },
    ]);
    assert.equal(line.listCents, 1000);
    assert.equal(line.discountCents, 0);
  });
});

describe("sumInvoiceDiscounts", () => {
  it("sums line discounts", () => {
    const lines = [
      buildInvoiceLine({
        id: "1",
        kind: "service",
        name: "A",
        qty: 1,
        listCents: 10000,
        unitCents: 8000,
      }),
      buildInvoiceLine({
        id: "2",
        kind: "part",
        name: "B",
        qty: 1,
        listCents: 5000,
        unitCents: 5000,
      }),
    ];
    assert.equal(sumInvoiceDiscounts(lines), 2000);
  });
});
