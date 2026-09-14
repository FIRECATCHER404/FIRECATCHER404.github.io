import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectId = "website-11b5c";
const instance = "website-11b5c-default-rtdb";
const apply = process.argv.includes("--apply");
const cleanEnv = { ...process.env };
delete cleanEnv.DEBUG;
delete cleanEnv.OPENAI_API_KEY;
delete cleanEnv.SAMBANOVA_API_KEY;

function firebase(args, capture = false) {
  const result = spawnSync("npx", ["--yes", "firebase-tools", ...args, "--project", projectId, "--instance", instance], {
    encoding: "utf8",
    env: cleanEnv,
    shell: process.platform === "win32",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });
  if (result.status !== 0) {
    throw new Error(capture ? (result.stderr || `Firebase CLI exited with ${result.status}`) : `Firebase CLI exited with ${result.status}`);
  }
  return result.stdout || "";
}

function readJson(path) {
  const output = firebase(["database:get", path], true).trim();
  return output && output !== "null" ? JSON.parse(output) : {};
}

const invites = readJson("/secureChat/invites");
const groups = readJson("/secureChat/groups");
const updates = {};
const now = Date.now();
let migrated = 0;

for (const [code, invite] of Object.entries(invites || {})) {
  if (!invite?.groupId) continue;
  const group = groups?.[invite.groupId] || {};
  const maxUses = [1, 5, 10, 25].includes(Number(invite.maxUses)) ? Number(invite.maxUses) : 10;
  const expiresAt = Number(invite.expiresAt) > now ? Number(invite.expiresAt) : now + 7 * 24 * 60 * 60 * 1000;
  const createdAtClient = Number(invite.createdAtClient) || now;
  const slots = {};
  for (let slot = 1; slot <= maxUses; slot += 1) slots[String(slot)] = true;
  const ownerHandle = invite.ownerHandle || group.ownerHandle;
  if (!ownerHandle) continue;

  const needsMigration = !invite.expiresAt || !invite.maxUses || !invite.createdAtClient || !invite.ownerHandle || !invite.slots
    || !group.inviteExpiresAt || !group.inviteMaxUses;
  if (!needsMigration) continue;
  migrated += 1;
  updates[`secureChat/invites/${code}/ownerHandle`] = ownerHandle;
  updates[`secureChat/invites/${code}/createdAtClient`] = createdAtClient;
  updates[`secureChat/invites/${code}/expiresAt`] = expiresAt;
  updates[`secureChat/invites/${code}/maxUses`] = maxUses;
  updates[`secureChat/invites/${code}/slots`] = invite.slots || slots;
  updates[`secureChat/groups/${invite.groupId}/inviteExpiresAt`] = expiresAt;
  updates[`secureChat/groups/${invite.groupId}/inviteMaxUses`] = maxUses;
}

if (!migrated) {
  console.log("Invite migration: no legacy invites needed changes.");
} else if (!apply) {
  console.log(`Invite migration dry run: ${migrated} legacy invite${migrated === 1 ? "" : "s"} would be updated.`);
} else {
  const tempDir = mkdtempSync(join(tmpdir(), "messager-invite-migration-"));
  const updateFile = join(tempDir, "updates.json");
  try {
    writeFileSync(updateFile, JSON.stringify(updates), "utf8");
    firebase(["database:update", "/", updateFile, "--force"]);
    console.log(`Invite migration: updated ${migrated} legacy invite${migrated === 1 ? "" : "s"}.`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
