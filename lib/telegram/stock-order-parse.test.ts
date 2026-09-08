import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  looksLikeStockOrderText,
  parseStockOrderText,
} from "./stock-order-parse";

const SAMPLE = `Order:
End plates x1
Cable 7-ft x1
Hinge #2 x2
Hinge #1 x2
Torsion conversion kit for 16x7 x1
Orb bracket x1
Bottom seal (blk 4") x1
Strut 16-ft x2

218*28 (red) x1
225*28 (blk) x1
234*30 (blk) x1
243*33 (red) x1
250*33 (pair) x1
po# sam82126

250*33 (red) x1
243*33 (blk) x1
262*34 (pair) x1
Center bearing x1
po# sam82426`;

describe("parseStockOrderText", () => {
  it("parses the handwritten Order screenshot format", () => {
    const parsed = parseStockOrderText(SAMPLE);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.lines.length, 17);
    assert.deepEqual(parsed.poNumbers, ["sam82126", "sam82426"]);

    const first = parsed.lines[0]!;
    assert.equal(first.rawName, "End plates");
    assert.equal(first.qty, 1);
    assert.equal(first.poNumber, null);

    const spring = parsed.lines.find((l) => l.rawName === "218*28 (red)");
    assert.ok(spring);
    assert.equal(spring!.poNumber, "sam82126");
    assert.equal(spring!.qty, 1);

    const last = parsed.lines[parsed.lines.length - 1]!;
    assert.equal(last.rawName, "Center bearing");
    assert.equal(last.poNumber, "sam82426");

    const pair = parsed.lines.find((l) => /pair/i.test(l.rawName));
    assert.ok(pair);
    assert.equal(pair!.qty, 1);
  });

  it("detects order-looking text", () => {
    assert.equal(looksLikeStockOrderText(SAMPLE), true);
    assert.equal(looksLikeStockOrderText("hello world"), false);
  });
});
