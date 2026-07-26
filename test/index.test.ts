import { type QueueJob } from "@lucid-softworks/queue-core";
import { describe, expect, it } from "vitest";

import {
  decodeQueueValue,
  deserializeQueueJobRecord,
  encodeQueueValue,
  QueueJobCodecError,
  queueJobFromRecord,
  queueJobToRecord,
  serializeQueueJobRecord,
} from "../src/index.js";

describe("queue store codec", () => {
  it("losslessly encodes supported values and repeated references", () => {
    const repeated = { value: 1 };
    const error = new TypeError("broken", { cause: new Error("root") });
    const value = {
      array: [undefined, null, true, "text", repeated],
      bigint: 12n,
      date: new Date("2026-01-01T00:00:00.000Z"),
      error,
      infinity: Number.POSITIVE_INFINITY,
      nan: Number.NaN,
      negativeInfinity: Number.NEGATIVE_INFINITY,
      negativeZero: -0,
      repeated,
    };
    const decoded = decodeQueueValue(encodeQueueValue(value)) as typeof value;
    expect(decoded.array.slice(0, 4)).toEqual([undefined, null, true, "text"]);
    expect(decoded.bigint).toBe(12n);
    expect(decoded.date).toEqual(value.date);
    expect(decoded.error).toBeInstanceOf(Error);
    expect(decoded.error.name).toBe("TypeError");
    expect(decoded.error.cause).toBeInstanceOf(Error);
    expect(decoded.infinity).toBe(Number.POSITIVE_INFINITY);
    expect(decoded.nan).toBeNaN();
    expect(decoded.negativeInfinity).toBe(Number.NEGATIVE_INFINITY);
    expect(Object.is(decoded.negativeZero, -0)).toBe(true);
    expect(decoded.repeated).toEqual(repeated);
  });

  it("handles errors without stack or cause and rejects unsupported values", () => {
    const error = new Error("plain");
    delete error.stack;
    const decoded = decodeQueueValue(encodeQueueValue(error)) as Error;
    expect(decoded.message).toBe("plain");
    expect(decoded.stack).toBeDefined();
    expect(() => encodeQueueValue(() => undefined)).toThrow(QueueJobCodecError);
    expect(() => encodeQueueValue(Symbol("x"))).toThrow(QueueJobCodecError);
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => encodeQueueValue(cyclic)).toThrow("cyclic");
    expect(() => decodeQueueValue("{")).toThrow("invalid");
    expect(() => decodeQueueValue('{"type":"unknown"}')).toThrow(
      QueueJobCodecError,
    );
  });

  it("round-trips jobs with and without optional persisted fields", () => {
    const base: QueueJob = {
      attempt: 0,
      availableAt: 1,
      createdAt: 1,
      data: undefined,
      id: "job",
      maxAttempts: 2,
      name: "work",
      priority: 3,
      state: "waiting",
      updatedAt: 1,
    };
    expect(queueJobFromRecord(queueJobToRecord(base))).toEqual(base);
    const complete: QueueJob = {
      ...base,
      deduplicationKey: "key",
      error: undefined,
      lease: { expiresAt: 10, token: "token", workerId: "worker" },
      result: undefined,
      state: "active",
    };
    const record = queueJobToRecord(complete);
    expect(queueJobFromRecord(record)).toEqual(complete);
    expect(deserializeQueueJobRecord(serializeQueueJobRecord(record))).toEqual(
      record,
    );
  });

  it("rejects malformed job records", () => {
    expect(() => deserializeQueueJobRecord("{")).toThrow("not valid JSON");
    for (const source of [
      "null",
      "{}",
      '{"id":1,"state":"waiting","dataJson":"x"}',
      '{"id":"x","state":"unknown","dataJson":"x"}',
      '{"id":"x","state":"waiting"}',
      '{"id":"x","state":"waiting","dataJson":1}',
    ])
      expect(() => deserializeQueueJobRecord(source)).toThrow(
        QueueJobCodecError,
      );
  });
});
