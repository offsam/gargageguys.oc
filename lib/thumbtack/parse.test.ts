import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyThumbtackWebhook } from "./parse";
import { isThumbtackWebhookAuthorized } from "./auth";

describe("classifyThumbtackWebhook", () => {
  it("parses partner lead payload", () => {
    const event = classifyThumbtackWebhook({
      leadID: "299614694480093245",
      createTimestamp: "1498760294",
      request: {
        requestID: "1",
        category: "Garage Door Repair",
        title: "Garage Door Repair",
        description: "Spring snapped",
        schedule: "Date: Tue, May 05 2020\nTime: 6:00 PM",
        location: {
          address1: "101 Alma Street",
          city: "Irvine",
          state: "CA",
          zipCode: "92602",
        },
        details: [{ question: "Type of property", answer: "Home" }],
      },
      customer: { customerID: "9", name: "John Davis", phone: "9495550100" },
      business: { businessID: "533172338874097690", name: "Garage Guys OC" },
      leadType: "CONTACT",
    });
    assert.equal(event.kind, "lead");
    if (event.kind !== "lead") return;
    assert.equal(event.leadId, "299614694480093245");
    assert.equal(event.name, "John Davis");
    assert.equal(event.phone, "9495550100");
    assert.equal(event.zip, "92602");
    assert.match(event.address, /101 Alma Street/);
    assert.match(event.message, /Spring snapped/);
    assert.match(event.message, /Type of property: Home/);
  });

  it("parses NegotiationCreatedV4-style payload", () => {
    const event = classifyThumbtackWebhook({
      eventType: "NegotiationCreatedV4",
      data: {
        negotiationID: "519153480500518912",
        category: { name: "Garage Door Repair" },
        customer: {
          displayName: "Olivia Y.",
          phone: "7145550199",
          location: { city: "Tustin", state: "CA", zipCode: "92780" },
        },
        details: [{ question: "Project scope", answer: "Broken spring" }],
      },
    });
    assert.equal(event.kind, "lead");
    if (event.kind !== "lead") return;
    assert.equal(event.leadId, "519153480500518912");
    assert.equal(event.name, "Olivia Y.");
    assert.equal(event.zip, "92780");
    assert.match(event.message, /Broken spring/);
  });

  it("parses message payload", () => {
    const event = classifyThumbtackWebhook({
      leadID: "299614694480093245",
      customerID: "1",
      businessID: "2",
      message: {
        messageID: "8699842694484326245",
        text: "Can you come today?",
      },
    });
    assert.equal(event.kind, "message");
    if (event.kind !== "message") return;
    assert.equal(event.leadId, "299614694480093245");
    assert.equal(event.text, "Can you come today?");
  });

  it("parses review payload", () => {
    const event = classifyThumbtackWebhook({
      reviewEventType: "REVIEW_ADDED",
      review: {
        reviewID: "318840849076158553",
        leadID: "299614694480093245",
        rating: "5",
        reviewerNickname: "Nick",
        text: "best service ever",
        createTime: "1517986598726",
        verified: true,
      },
    });
    assert.equal(event.kind, "review");
    if (event.kind !== "review") return;
    assert.equal(event.reviewId, "318840849076158553");
    assert.equal(event.rating, 5);
    assert.equal(event.author, "Nick");
  });

  it("parses lead price update", () => {
    const event = classifyThumbtackWebhook({
      leadID: "465324000282984455",
      leadPrice: "$26.00",
      chargeState: "Charged",
    });
    assert.equal(event.kind, "lead_update");
    if (event.kind !== "lead_update") return;
    assert.equal(event.leadPrice, "$26.00");
  });

  it("returns unknown for empty objects", () => {
    assert.equal(classifyThumbtackWebhook({}).kind, "unknown");
    assert.equal(classifyThumbtackWebhook(null).kind, "unknown");
  });
});

describe("thumbtack webhook auth", () => {
  it("accepts query key", () => {
    assert.equal(
      isThumbtackWebhookAuthorized({
        searchParams: new URLSearchParams("key=secret-1"),
        authorization: null,
        headerSecret: null,
        expected: "secret-1",
      }),
      true,
    );
  });

  it("accepts HTTP basic password", () => {
    const basic = Buffer.from("thumbtack:secret-1").toString("base64");
    assert.equal(
      isThumbtackWebhookAuthorized({
        searchParams: new URLSearchParams(),
        authorization: `Basic ${basic}`,
        headerSecret: null,
        expected: "secret-1",
      }),
      true,
    );
  });

  it("rejects wrong secret", () => {
    assert.equal(
      isThumbtackWebhookAuthorized({
        searchParams: new URLSearchParams("key=nope"),
        authorization: null,
        headerSecret: null,
        expected: "secret-1",
      }),
      false,
    );
  });
});
