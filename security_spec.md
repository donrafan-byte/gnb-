# Security Specification — CZGNB-23 Trujillo (Comando de Zona Nro. 23 GNB — Phase 0 TDD)

## 1. Data Invariants
1. Every document across `commissions`, `incidents`, `patrolPoints`, `gangZones`, `friendlyForces`, and `zoneUnits` MUST carry an immutable `ownerId` matching `request.auth.uid` on creation.
2. Every authenticated write requires `request.auth.token.email_verified == true`.
3. Every single-document operation (`get`, `create`, `update`, `delete`) enforces `isValidId(docId)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
4. PII Isolation: `officers/{officerId}`, `accessCodes/{codeId}`, `auditLogs/{logId}`, and `admins/{adminId}` are strictly isolated and readable ONLY by the document owner (`resource.data.ownerId == request.auth.uid` / `uid == request.auth.uid`) or a verified admin (`isAdmin()`). Shared CZGNB-23 command operational collections (`commissions`, `incidents`, `patrolPoints`, `liveLocations`, `wantedRecords`, `verificationLogs`, `gangZones`, `friendlyForces`, and `zoneUnits`) are readable in real time by all explicitly authorized CZGNB-23 officers (`isAuthorizedOfficer()`) and strictly blocked for unauthenticated, unverified, pending, or expelled accounts.
5. All user-scoped PII/audit list queries (`officers`, `auditLogs`, `accessCodes`) enforce `resource.data.ownerId == request.auth.uid || isAdmin()` (or `isAdmin()` only) directly in the rules. Shared CZGNB-23 operational lists (`commissions`, `incidents`, `patrolPoints`, `liveLocations`, `wantedRecords`, `verificationLogs`, `gangZones`, `friendlyForces`, `zoneUnits`) strictly enforce `isVerified() && isAuthorizedOfficer()` on the server.
6. Every `create` and `update` invokes `isValid[Entity](incoming())` first, enforcing strict `hasAll` + `hasOnly` keys, exact types, numeric coordinate bounds for Trujillo State (`lat: 8.5..10.5`, `lng: -72.0..-69.5`), bounded arrays (`<= 20` or `<= 8`), and server timestamps (`request.time`).
7. Terminal State Locking: Once a commission reaches `estado == 'finalizada'` or an incident reaches `estado == 'cerrada'`, non-admin updates are strictly rejected.
8. Updates are split into explicit action branches using `incoming().diff(existing()).affectedKeys().hasOnly([...])` while enforcing immutable `ownerId` and `createdAt`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Identity Spoofing on Create**: Creating a `commissions` or `zoneUnits` doc with `ownerId: "victim_uid"` while authenticated as `"attacker_uid"`.
2. **Shadow Field Injection**: Creating or updating a `commissions` or `zoneUnits` doc with an undeclared field `isVerified: true` or `role: "admin"`.
3. **Unverified Email Write**: Attempting any write with `email_verified: false` (including spoofing admin email).
4. **Cross-Owner PII Read**: Authenticated user B attempting `get` on user A's `officers/{userA}` profile, `auditLogs/{logId}`, or `accessCodes/{codeId}`.
5. **Blanket List Scraping**: Authenticated non-admin user B executing an unfiltered `list` query on `officers` or `auditLogs`, or a pending/expelled/unverified user attempting to list any shared CZGNB-23 operational collection (`commissions`, `incidents`, `patrolPoints`, `liveLocations`, `wantedRecords`, `verificationLogs`, `gangZones`, `friendlyForces`, `zoneUnits`).
6. **ID Poisoning**: Creating a document with a 500-character or path-traversal ID like `bad..id/../../etc`.
7. **Timestamp Forgery**: Creating a `commissions` or `zoneUnits` doc with client-forged `createdAt` instead of `request.time`.
8. **Immutable Field Tampering**: Updating `ownerId` or `createdAt` on an existing `commissions`, `incidents`, or `zoneUnits` document.
9. **Terminal State Bypass**: Updating a `commissions` doc whose existing `estado` is `'finalizada'` as a non-admin.
10. **Array Exhaustion (Denial of Wallet)**: Creating a `commissions` doc with 25 entries in `armamento` or `efectivos` (exceeding max 20), or invalid first-element type (`efectivos: [123]`).
11. **Value Poisoning on Allowlisted Key**: Updating `lat` to `"not-a-number"` or out-of-bounds `lat: 85.0` during a location update action.
12. **Privilege Escalation**: Writing directly to `/admins/{attackerUid}`, self-assigning `privilegio: "administrador"` or `"supervisor"` on `/officers/{attackerUid}` create, or self-updating `privilegio` in Action 1.
13. **Read-Only (`consulta`) Write Attempt**: An authorized user with `privilegio == 'consulta'` attempting to create/update `commissions`, `incidents`, `patrolPoints`, `liveLocations`, `gangZones`, `friendlyForces`, `zoneUnits`, or `verificationLogs`.
14. **Standard User (`operador`) Cross-Owner Tampering / Delete Attempt**: An authorized user with `privilegio == 'operador'` attempting to edit/delete a `gangZone`, `friendlyForce`, or `zoneUnit` owned by the Admin or another user, attempting to create/update/delete `wantedRecords`, or attempting to delete any operational document.
15. **Primary Admin Protection**: Any delegated admin attempting to demote or expel `donrafan@gmail.com` or grant `'administrador'` privilege without being `isBootstrappedAdmin()`.
