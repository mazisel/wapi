import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config/index.js";
import { QUEUE_NAME_PREFIX } from "../config/constants.js";

export interface MessageJobData {
  messageId: string;
  deviceId: string;
  toJid: string;
  type: "text";
  text: string;
}

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const queues = new Map<string, Queue<MessageJobData>>();

export function getQueue(deviceId: string): Queue<MessageJobData> {
  if (!queues.has(deviceId)) {
    const queue = new Queue<MessageJobData>(
      `${QUEUE_NAME_PREFIX}-${deviceId}-messages`,
      {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 200 },
        },
      }
    );
    queues.set(deviceId, queue);
  }
  return queues.get(deviceId)!;
}

export async function enqueueMessage(
  data: MessageJobData,
  delayMs = 0
): Promise<string> {
  const queue = getQueue(data.deviceId);
  const job = await queue.add("send", data, { delay: delayMs });
  return job.id!;
}

export { connection as redisConnection };
