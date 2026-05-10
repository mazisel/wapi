import { Queue } from "bullmq";
import { redisConnection } from "../queue/message-queue.js";

export interface AlertJobData {
  alertId: string;
  wave: 1 | 2;
}

const ALERT_QUEUE_NAME = "wapi-group-alerts";
const WAVE_DELAY_MS = 5 * 60 * 1_000; // 5 minutes

let alertQueue: Queue<AlertJobData> | null = null;

export function getAlertQueue(): Queue<AlertJobData> {
  if (!alertQueue) {
    alertQueue = new Queue<AlertJobData>(ALERT_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return alertQueue;
}

export async function enqueueWave1(alertId: string): Promise<void> {
  const queue = getAlertQueue();
  await queue.add(
    "wave1",
    { alertId, wave: 1 },
    { delay: WAVE_DELAY_MS, jobId: `wave1-${alertId}` }
  );
}

export async function enqueueWave2(alertId: string): Promise<void> {
  const queue = getAlertQueue();
  await queue.add(
    "wave2",
    { alertId, wave: 2 },
    { delay: WAVE_DELAY_MS, jobId: `wave2-${alertId}` }
  );
}

export { ALERT_QUEUE_NAME };
