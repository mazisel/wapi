import type { WASocket } from "@whiskeysockets/baileys";
import { sleep } from "./delay-engine.js";
import {
  TYPING_MIN_MS,
  TYPING_MAX_MS,
  TYPING_MS_PER_CHAR,
} from "../config/constants.js";

function random(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function simulateTyping(
  socket: WASocket,
  jid: string,
  text: string
): Promise<void> {
  const typingMs = Math.min(
    random(TYPING_MIN_MS, TYPING_MAX_MS),
    text.length * TYPING_MS_PER_CHAR
  );

  await socket.sendPresenceUpdate("composing", jid);
  await sleep(typingMs);
  await socket.sendPresenceUpdate("paused", jid);
  await sleep(random(200, 800));
}
