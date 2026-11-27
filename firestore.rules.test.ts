/**
 * Security TDD Specification for CZGNB-23 Trujillo (Comando de Zona Nro. 23 GNB) Firestore Rules.
 * Verifies the "Dirty Dozen" adversarial payloads against the Eight Pillars.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  rationale: string;
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Commission Create',
    collection: 'commissions',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'incoming().ownerId must strictly match request.auth.uid.',
    payload: { ownerId: 'other_officer_uid', codigo: 'COM-999' },
  },
  {
    id: 2,
    name: 'Shadow Field Injection',
    collection: 'commissions',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidCommission enforces keys().hasOnly(...) blocking undeclared fields.',
    payload: { isVerified: true, role: 'admin' },
  },
  {
    id: 3,
    name: 'Email Spoofing with email_verified=false',
    collection: 'commissions',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isVerified() requires request.auth.token.email_verified == true.',
  },
  {
    id: 4,
    name: 'Cross-Owner PII Read',
    collection: 'officers',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    rationale: 'PII documents are strictly readable by owner or verified admin.',
  },
  {
    id: 5,
    name: 'Blanket List Scraping on PII / Audit Logs',
    collection: 'auditLogs',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    rationale: 'allow list on auditLogs/officers strictly enforces resource.data.ownerId == request.auth.uid || isAdmin(), and shared operational collections block pending/expelled/unverified users via isAuthorizedOfficer().',
  },
  {
    id: 6,
    name: 'ID Poisoning (>128 chars or invalid chars)',
    collection: 'incidents',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidId() enforces ^[a-zA-Z0-9_\\-]+$ and size <= 128.',
  },
  {
    id: 7,
    name: 'Client Timestamp Forgery',
    collection: 'incidents',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'createdAt and updatedAt must strictly equal request.time.',
  },
  {
    id: 8,
    name: 'Immutable ownerId / createdAt Tampering',
    collection: 'commissions',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'ownerId and createdAt are verified equal to existing() and excluded from affectedKeys().hasOnly().',
  },
  {
    id: 9,
    name: 'Terminal State Modification (finalizada / cerrada)',
    collection: 'commissions',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'Non-admin updates are blocked once estado == finalizada or cerrada.',
  },
  {
    id: 10,
    name: 'Array Exhaustion / Invalid Element Type',
    collection: 'commissions',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'armamento and efectivos enforce size() >= 1 && size() <= 20 and element map schema checks.',
  },
  {
    id: 11,
    name: 'Value Poisoning on Coordinates',
    collection: 'commissions',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidCommission runs on every update and rejects non-numeric or out-of-bounds coordinates.',
  },
  {
    id: 12,
    name: 'Self-Assigned Admin Escalation',
    collection: 'admins',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Client writes to /admins are unconditionally denied.',
  },
  {
    id: 13,
    name: 'Unauthorized Listing of Shared CZGNB-23 Zone Units',
    collection: 'zoneUnits',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    rationale: 'Pending, expelled, or unverified accounts are blocked by isAuthorizedOfficer().',
  },
  {
    id: 14,
    name: 'Consulta (Read-Only) User Writing Zone Unit',
    collection: 'zoneUnits',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'canOperateField() blocks consulta users from mutating zoneUnits.',
  },
];
