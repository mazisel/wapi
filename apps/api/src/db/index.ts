import { createDb } from "@wapi/db";
import { config } from "../config/index.js";

export const db = createDb(config.DATABASE_URL);
export type { Db } from "@wapi/db";
