import { type QueueJob, type QueueJobState } from "@lucid-softworks/queue-core";
import {
  decodeStructuredValue,
  encodeStructuredValue,
  type StructuredValueCodecError,
} from "@lucid-softworks/structured-value-codec";

export type QueueJobRecord = Readonly<{
  id: string;
  name: string;
  state: QueueJobState;
  priority: number;
  attempt: number;
  maxAttempts: number;
  availableAt: number;
  createdAt: number;
  updatedAt: number;
  dataJson: string;
  deduplicationKey: string | null;
  leaseToken: string | null;
  leaseWorkerId: string | null;
  leaseExpiresAt: number | null;
  resultJson: string | null;
  errorJson: string | null;
}>;

const states = new Set<QueueJobState>([
  "waiting",
  "scheduled",
  "active",
  "completed",
  "failed",
  "dead-letter",
  "cancelled",
]);

export class QueueJobCodecError extends Error {
  override readonly name = "QueueJobCodecError";
}

function translateCodecError(cause: unknown): never {
  throw new QueueJobCodecError((cause as StructuredValueCodecError).message, {
    cause,
  });
}

export function encodeQueueValue(value: unknown): string {
  try {
    return encodeStructuredValue(value);
  } catch (cause) {
    return translateCodecError(cause);
  }
}

export function decodeQueueValue(source: string): unknown {
  try {
    return decodeStructuredValue(source);
  } catch (cause) {
    return translateCodecError(cause);
  }
}

export function queueJobToRecord(job: QueueJob): QueueJobRecord {
  return {
    attempt: job.attempt,
    availableAt: job.availableAt,
    createdAt: job.createdAt,
    dataJson: encodeQueueValue(job.data),
    deduplicationKey: job.deduplicationKey ?? null,
    errorJson: Object.hasOwn(job, "error") ? encodeQueueValue(job.error) : null,
    id: job.id,
    leaseExpiresAt: job.lease?.expiresAt ?? null,
    leaseToken: job.lease?.token ?? null,
    leaseWorkerId: job.lease?.workerId ?? null,
    maxAttempts: job.maxAttempts,
    name: job.name,
    priority: job.priority,
    resultJson: Object.hasOwn(job, "result")
      ? encodeQueueValue(job.result)
      : null,
    state: job.state,
    updatedAt: job.updatedAt,
  };
}

export function queueJobFromRecord(record: QueueJobRecord): QueueJob {
  return {
    attempt: record.attempt,
    availableAt: record.availableAt,
    createdAt: record.createdAt,
    data: decodeQueueValue(record.dataJson),
    id: record.id,
    maxAttempts: record.maxAttempts,
    name: record.name,
    priority: record.priority,
    state: record.state,
    updatedAt: record.updatedAt,
    ...(record.deduplicationKey === null
      ? {}
      : { deduplicationKey: record.deduplicationKey }),
    ...(record.leaseToken === null ||
    record.leaseWorkerId === null ||
    record.leaseExpiresAt === null
      ? {}
      : {
          lease: {
            expiresAt: record.leaseExpiresAt,
            token: record.leaseToken,
            workerId: record.leaseWorkerId,
          },
        }),
    ...(record.resultJson === null
      ? {}
      : { result: decodeQueueValue(record.resultJson) }),
    ...(record.errorJson === null
      ? {}
      : { error: decodeQueueValue(record.errorJson) }),
  };
}

export function serializeQueueJobRecord(record: QueueJobRecord): string {
  return JSON.stringify(record);
}

export function deserializeQueueJobRecord(source: string): QueueJobRecord {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (cause) {
    throw new QueueJobCodecError("Stored queue job is not valid JSON", {
      cause,
    });
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("state" in value) ||
    !states.has(value.state as QueueJobState) ||
    !("dataJson" in value) ||
    typeof value.dataJson !== "string"
  )
    throw new QueueJobCodecError("Stored queue job record is invalid");
  return value as QueueJobRecord;
}
