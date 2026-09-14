const projectId = "website-11b5c";
const namespace = "website-11b5c-default-rtdb";
const authBase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const dbBase = "http://127.0.0.1:9000";

async function signUp(name) {
  const response = await fetch(`${authBase}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `${name}@example.test`, password: "test-password", returnSecureToken: true })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Auth emulator sign-up failed: ${JSON.stringify(body)}`);
  return { uid: body.localId, token: body.idToken };
}

async function request(path, { token = "", method = "GET", body, admin = false } = {}) {
  const url = new URL(`${dbBase}/${path.replace(/^\/+/, "")}.json`);
  url.searchParams.set("ns", namespace);
  if (token) url.searchParams.set("auth", token);
  const headers = { "content-type": "application/json" };
  if (admin) headers.authorization = "Bearer owner";
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let value = null;
  try { value = await response.json(); } catch { value = null; }
  return { ok: response.ok, status: response.status, value };
}

function expectAllowed(result, label) {
  if (!result.ok) throw new Error(`${label}: expected allowed, got ${result.status} ${JSON.stringify(result.value)}`);
  console.log(`PASS allowed: ${label}`);
}

function expectDenied(result, label) {
  if (result.ok) throw new Error(`${label}: expected denied, got ${result.status} ${JSON.stringify(result.value)}`);
  console.log(`PASS denied:  ${label}`);
}

function member(user, role, extra = {}) {
  return {
    role,
    handle: user.handle,
    displayName: user.displayName,
    color: user.color,
    joinedAt: Date.now(),
    ...extra
  };
}

function friendEntry(user, since) {
  return { uid: user.uid, handle: user.handle, displayName: user.displayName, color: user.color, since };
}

async function main() {
  expectAllowed(await request("", { method: "DELETE", admin: true }), "clear emulator database");

  const identities = await Promise.all(["alice", "bobby", "carol", "david"].map(signUp));
  const users = identities.map((identity, index) => ({
    ...identity,
    handle: ["alice", "bobby", "carol", "david"][index],
    displayName: ["Alice", "Bobby", "Carol", "David"][index],
    color: ["#2563eb", "#7c3aed", "#059669", "#dc2626"][index]
  }));
  const [alice, bob, carol, david] = users;

  for (const user of users) {
    expectAllowed(await request(`secureChat/users/${user.uid}`, {
      token: user.token,
      method: "PUT",
      body: { handle: user.handle, displayName: user.displayName, color: user.color, updatedAt: Date.now() }
    }), `create ${user.handle} profile`);
  }

  const nonce = "a".repeat(32);
  expectAllowed(await request(`secureChat/socialRateLimits/${alice.uid}`, {
    token: alice.token,
    method: "PUT",
    body: { action: "friend", targetUid: bob.uid, nonce, at: Date.now() }
  }), "claim friend-request cooldown");
  expectDenied(await request(`secureChat/socialRateLimits/${alice.uid}`, {
    token: alice.token,
    method: "PUT",
    body: { action: "friend", targetUid: carol.uid, nonce: "b".repeat(32), at: Date.now() }
  }), "enforce social cooldown");

  const friendRequest = {
    senderUid: alice.uid,
    targetUid: bob.uid,
    handle: alice.handle,
    displayName: alice.displayName,
    color: alice.color,
    actionNonce: nonce,
    createdAt: Date.now(),
    createdAtClient: Date.now()
  };
  expectAllowed(await request(`secureChat/friendRequests/${bob.uid}/${alice.uid}`, {
    token: alice.token,
    method: "PUT",
    body: friendRequest
  }), "send friend request with matching rate claim");
  expectAllowed(await request(`secureChat/friendRequests/${bob.uid}`, { token: bob.token }), "recipient reads requests");
  expectDenied(await request(`secureChat/friendRequests/${bob.uid}`, { token: carol.token }), "outsider cannot read requests");
  expectDenied(await request(`secureChat/friendRequests/${carol.uid}/${alice.uid}`, {
    token: alice.token,
    method: "PUT",
    body: { ...friendRequest, targetUid: carol.uid }
  }), "rate claim cannot be reused for another target");

  const since = Date.now();
  expectAllowed(await request("", {
    token: bob.token,
    method: "PATCH",
    body: {
      [`secureChat/friends/${bob.uid}/${alice.uid}`]: friendEntry(alice, since),
      [`secureChat/friends/${alice.uid}/${bob.uid}`]: friendEntry(bob, since),
      [`secureChat/friendRequests/${bob.uid}/${alice.uid}`]: null
    }
  }), "accept request and create reciprocal friendship atomically");
  expectDenied(await request(`secureChat/friends/${carol.uid}/${david.uid}`, {
    token: carol.token,
    method: "PUT",
    body: friendEntry(david, Date.now())
  }), "cannot create friendship without a request");
  alice.displayName = "Alice Updated";
  expectAllowed(await request(`secureChat/users/${alice.uid}`, {
    token: alice.token,
    method: "PUT",
    body: { handle: alice.handle, displayName: alice.displayName, color: alice.color, updatedAt: Date.now() }
  }), "friend updates own profile");
  expectAllowed(await request(`secureChat/friends/${bob.uid}/${alice.uid}`, {
    token: alice.token,
    method: "PUT",
    body: friendEntry(alice, since)
  }), "friend syncs own profile snapshot to reciprocal list");
  expectDenied(await request(`secureChat/friends/${bob.uid}/${alice.uid}`, {
    token: bob.token,
    method: "PUT",
    body: { ...friendEntry(alice, since), displayName: "Forged" }
  }), "list owner cannot forge a friend's profile snapshot");

  const dmGroup = {
    kind: "dm",
    name: "Direct message",
    description: "Private one-to-one conversation",
    privacy: "private",
    ownerUid: alice.uid,
    ownerHandle: alice.handle,
    dmPeerUid: bob.uid,
    createdAt: Date.now(),
    createdAtClient: Date.now(),
    updatedAt: Date.now(),
    members: { [alice.uid]: member(alice, "owner"), [bob.uid]: member(bob, "member") }
  };
  expectAllowed(await request("secureChat/groups/dm_allowed", { token: alice.token, method: "PUT", body: dmGroup }), "friends create a DM");
  expectDenied(await request("secureChat/groups/dm_nonfriend", {
    token: alice.token,
    method: "PUT",
    body: { ...dmGroup, dmPeerUid: carol.uid, members: { [alice.uid]: member(alice, "owner"), [carol.uid]: member(carol, "member") } }
  }), "non-friends cannot create a DM");
  expectDenied(await request("secureChat/groups/dm_third_member", {
    token: alice.token,
    method: "PUT",
    body: { ...dmGroup, members: { ...dmGroup.members, [carol.uid]: member(carol, "member") } }
  }), "DM creation cannot add a third member");

  expectAllowed(await request("", {
    token: alice.token,
    method: "PATCH",
    body: {
      [`secureChat/memberships/${alice.uid}/dm_allowed`]: { name: bob.displayName, privacy: "private", role: "owner", ownerHandle: alice.handle, kind: "dm", peerUid: bob.uid, peerHandle: bob.handle, joinedAt: Date.now() },
      [`secureChat/memberships/${bob.uid}/dm_allowed`]: { name: alice.displayName, privacy: "private", role: "member", ownerHandle: alice.handle, kind: "dm", peerUid: alice.uid, peerHandle: alice.handle, joinedAt: Date.now() }
    }
  }), "create both DM conversation-list entries");
  expectAllowed(await request("secureChat/groups/dm_allowed", { token: bob.token }), "DM peer reads conversation");
  expectDenied(await request("secureChat/groups/dm_allowed", { token: carol.token }), "outsider cannot read DM");
  expectDenied(await request("secureChat/groups/dm_allowed/name", { token: alice.token, method: "PUT", body: "Tampered" }), "DM owner cannot mutate membership boundaries");

  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const privateGroup = {
    name: "Invite Test",
    description: "",
    privacy: "private",
    ownerUid: alice.uid,
    ownerHandle: alice.handle,
    inviteCode: "INVITECODE12",
    inviteExpiresAt: expiresAt,
    inviteMaxUses: 1,
    createdAt: Date.now(),
    createdAtClient: Date.now(),
    updatedAt: Date.now(),
    members: { [alice.uid]: member(alice, "owner") }
  };
  expectAllowed(await request("secureChat/groups/invite_group", { token: alice.token, method: "PUT", body: privateGroup }), "owner creates private group");
  const invite = {
    groupId: "invite_group",
    groupName: "Invite Test",
    createdBy: alice.uid,
    ownerHandle: alice.handle,
    createdAt: Date.now(),
    createdAtClient: Date.now(),
    expiresAt,
    maxUses: 1,
    slots: { 1: true }
  };
  expectAllowed(await request("secureChat/invites/INVITECODE12", { token: alice.token, method: "PUT", body: invite }), "owner creates expiring one-use invite");
  expectAllowed(await request("secureChat/inviteUses/INVITECODE12/1", { token: bob.token, method: "PUT", body: bob.uid }), "first user claims invite slot");
  expectDenied(await request("secureChat/inviteUses/INVITECODE12/1", { token: carol.token, method: "PUT", body: carol.uid }), "second user cannot exceed invite cap");
  expectDenied(await request(`secureChat/groups/invite_group/members/${carol.uid}`, {
    token: carol.token,
    method: "PUT",
    body: member(carol, "member", { inviteCode: "INVITECODE12", inviteSlot: "1" })
  }), "unclaimed user cannot join with another user's slot");
  expectAllowed(await request(`secureChat/groups/invite_group/members/${bob.uid}`, {
    token: bob.token,
    method: "PUT",
    body: member(bob, "member", { inviteCode: "INVITECODE12", inviteSlot: "1" })
  }), "slot owner joins private group");

  const expiredCode = "EXPIREDCODE1";
  expectAllowed(await request(`secureChat/invites/${expiredCode}`, {
    admin: true,
    method: "PUT",
    body: { ...invite, expiresAt: Date.now() - 1000, slots: { 1: true } }
  }), "seed expired invite as emulator admin");
  expectDenied(await request(`secureChat/inviteUses/${expiredCode}/1`, { token: david.token, method: "PUT", body: david.uid }), "expired invite cannot be claimed");

  console.log(`\nAll messaging security-rule tests passed for ${projectId}.`);
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
