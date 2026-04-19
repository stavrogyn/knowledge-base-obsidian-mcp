/**
 * Must be imported first so .env and KB_VAULT_PATH are set before src/config loads.
 */
import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../.env"), quiet: true });

if (!process.env.KB_VAULT_PATH) {
  process.env.KB_VAULT_PATH = resolve(homedir(), "knowledge-base");
}
