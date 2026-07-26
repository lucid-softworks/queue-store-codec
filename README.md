# `@lucid-softworks/queue-store-codec`

The shared durable representation used by Lucid queue storage adapters.

```ts
import {
  queueJobFromRecord,
  queueJobToRecord,
} from "@lucid-softworks/queue-store-codec";

const record = queueJobToRecord(job);
const restored = queueJobFromRecord(record);
```

The codec preserves `undefined`, non-finite numbers, negative zero, bigint,
dates, nested errors and causes, arrays, and objects. Cyclic values, functions,
and symbols are rejected with `QueueJobCodecError`. Records keep scheduling,
lease, and deduplication fields indexable while encoding data, result, and error
values independently.

`serializeQueueJobRecord` and `deserializeQueueJobRecord` provide the JSON
representation used by Redis. SQL adapters store the same record as columns.
