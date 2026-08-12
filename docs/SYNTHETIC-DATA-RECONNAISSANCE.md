# Synthetic Enterprise Data Generation — Reconnaissance Report

**Status: RECONNAISSANCE ONLY.** No application code was modified, no synthetic
data was generated, no seed data was created, no migrations were run. This
document is a read-only implementation map of the real Factory » Foundation
(FF) application, produced to establish ground truth before any synthetic
data specification, generator, or import mechanism is designed.

**Repo inspected:** `Factory_Foundation_design_pass` (git remote
`ConstructionEnterprise/Factory_To_Foundation`), specifically `backend/`
(Fastify + Prisma + PostgreSQL) and `Factory_To_Foundation/frontend/` (React +
Vite). `factory-runtime/`, `blender-bridge/`, and `twin-bridge--DO-NOT-USE/`
were not in scope for this pass — they front the CE digital twin and a
Blender geometry pipeline respectively, not enterprise business data.

**Methodology note on this report's own provenance:** most of this
investigation was conducted directly against the real files (full read of
`backend/prisma/schema.prisma`, `backend/prisma/seed.ts`, every file under
`backend/src/routes/`, targeted reads of `backend/src/middleware/auth.ts` and
representative service/route files, and repository-wide greps across the
frontend `src/` tree). Every entity, route, and seed count below is cited to
the file that establishes it. Where a claim rests on a grep rather than a
full read (e.g., "no test files exist"), that is stated explicitly.

---

## 1. Executive Summary

FF's real backend data model is **34 Prisma models**, confirmed by a full
read of `backend/prisma/schema.prisma` (1133 lines). They cluster into eight
real subsystems: RBAC (Module/Role/Permission/RolePermission/User/
RefreshToken/UserPreference), Manufacturing→Factory instructions
(InstructionSet/Step/Execution), Factory collision monitoring
(MonitoringSession/CollisionEvent), Construction
(Project/Site/TreeNode/ProjectFile), Genealogy (Node/Edge), Scheduling
(Stage/Port/Wire/Task/TaskDependency/TaskStatusEvent), Logistics
(Material/Module/Truck/Driver/Dispatch/MileageRateConfig/CustodyEvent/
Document), and Compliance (ComplianceDocument) plus standalone Networking
(Vlan/Device).

**The single most important finding for synthetic-data planning**: several
of the conceptual entities named in the investigation brief — **Employees,
Facilities, Zones, Assets (as a real backend entity), Maintenance, Receiving,
Storage, Yard, and general "People/Personnel"** — either do not exist as
Prisma models at all, or exist only as frontend-only fixture data with zero
backend/database backing. Confirmed absent or fixture-only in §3/§4/§8 below,
not assumed.

**Second major finding**: the word **"Module"** and the word **"Material"**
each refer to **genuinely different, unconnected real entities** depending on
which subsystem you're in (RBAC `Module` vs. Logistics `LogisticsModule` vs.
Genealogy's `module` tier value; Logistics `LogisticsMaterial` vs.
Genealogy's `material` tier value). This is not an oversight this report is
inventing — the schema's own comments explicitly disclose it as an open,
unresolved question (`schema.prisma` lines 702–709, quoting "CLAUDE.md gap
#12"). Any synthetic-data specification must not silently merge these.

**Third finding**: Genealogy has a real, seeded, Prisma-backed table
(13 nodes, 12 edges) but **zero API routes** — the frontend reads a
completely separate static TypeScript fixture file instead
(`features/genealogy/graphData.ts`), never the database. The seeded rows are
real but functionally orphaned from the running application. Same
disconnection pattern for `MonitoringSession`/`CollisionEvent` (schema
exists, zero routes, frontend computes everything in-memory instead).

**No existing bulk-load, import, or test-fixture mechanism exists** beyond
`prisma/seed.ts` (an idempotent upsert script, deliberately committing zero
rows for most business entities) and per-entity REST `POST` routes. No CSV/
JSON import endpoint, no test suite, no fixture/factory library, anywhere in
either the backend or frontend (confirmed by an empty grep for
`*.test.ts`/`*.spec.ts`/`*fixture*`/`*factory*` across both trees).

---

## 2. Repository/Application Architecture Relevant to Synthetic Data

- **Backend**: Fastify + TypeScript, `backend/src/`, organized as
  `routes/` (HTTP layer, Zod validation, permission gates) →
  `services/` (business logic) → `repositories/` (Prisma queries). One file
  per entity/feature in each layer, consistently named
  (`logisticsDispatches.ts` route → `logisticsDispatchService.ts` →
  `logisticsDispatchRepository.ts`).
- **ORM**: Prisma 7, PostgreSQL, schema at `backend/prisma/schema.prisma`.
  Connection string lives in `prisma.config.ts`, not the schema file (a
  Prisma 7 requirement, per the schema's own comment at line 24-27).
- **Migrations**: 11 real migrations under `backend/prisma/migrations/`,
  timestamp-ordered from `20260724184947_init` through
  `20260808043542_logistics_mileage_tax_report` — see §11 for the full
  ordered list and what each added.
- **Auth**: httpOnly-cookie JWT (`ff_access_token`, 15-min TTL) +
  server-side revocable refresh token (`ff_refresh_token`, 30-day TTL,
  hashed at rest) — `backend/src/middleware/auth.ts`,
  `backend/src/lib/jwt.ts`, `backend/src/lib/refreshToken.ts`. See §9.
- **File storage**: S3-key-only rows (`ProjectFile`, `LogisticsDocument`,
  `ComplianceDocument`) — bytes never touch Postgres, uploads/downloads go
  through presigned URLs (`backend/src/lib/s3.ts`).
- **Frontend**: React + Vite, `Factory_To_Foundation/frontend/src/`,
  organized under `features/<domain>/`. A real backend API client exists
  per feature that has one, named `<domain>Api.ts` — confirmed present for
  8 of 14 feature directories (§8). The remaining features
  (genealogy, robotics, assets, manufacturing's 3D geometry, factory's twin
  data) read from either static fixtures or the separate Factory Runtime
  service, never the Postgres-backed API.
- **No test infrastructure exists** in either backend or frontend as of
  this reconnaissance (confirmed by grep, not assumed — see §10).

---

## 3. Confirmed Domain Entities

All 34 models below are taken directly from `backend/prisma/schema.prisma`
(full file read). Grouped by the schema's own section comments.

| Group | Models |
|---|---|
| RBAC | `Module`, `Role`, `Permission`, `RolePermission`, `User`, `RefreshToken`, `UserPreference` |
| Manufacturing → Factory instructions | `InstructionSet`, `InstructionStep`, `InstructionExecution` |
| Factory collision monitor | `MonitoringSession`, `CollisionEvent` |
| Construction | `ConstructionProject`, `ConstructionSite`, `ConstructionTreeNode`, `ProjectFile` |
| Genealogy | `GenealogyNode`, `GenealogyEdge` |
| Scheduling (pipeline taxonomy) | `ScheduleStage`, `SchedulePort`, `ScheduleWire` |
| Scheduling (task instances) | `ScheduleTask`, `ScheduleTaskDependency`, `ScheduleTaskStatusEvent` |
| Logistics | `LogisticsMaterial`, `LogisticsModule`, `LogisticsTruck`, `LogisticsDriver`, `LogisticsDispatch`, `MileageRateConfig`, `LogisticsCustodyEvent`, `LogisticsDocument` |
| Compliance | `ComplianceDocument` |
| Networking | `NetworkVlan`, `NetworkDevice` |

**Explicitly confirmed NOT to exist as real entities anywhere in the
codebase** (Prisma schema, backend routes, or frontend types) — these were
named as investigation targets in the brief; each was actively searched for,
not assumed absent:

- **Employee / Personnel / People** — no model, no route, no frontend type.
  The only trace is `ComplianceDocument.subject`, a free-text field
  described in the schema itself as "who/what this document is about (an
  employee name, an equipment id, a site) — deliberately not a real FK to
  any employee/equipment table, since neither exists yet (see gap B7)"
  (`schema.prisma` lines 1011-1014). Confirmed via repo-wide grep for
  `employee` — the only hits are in `administration/complianceDocumentsApi.ts`
  and the Compliance Records UI, both consistent with this free-text field.
- **Facility / Facilities** — zero matches anywhere in `Factory_To_Foundation/frontend/src/` (grep `facility\b`, case-insensitive, empty result).
- **Zone** (as its own entity) — not a table or column. The schema's own
  Logistics section header explains the real design: "Zone is expressed by
  which table a row lives in — matching the real LogisticsZone groupings
  LogisticsBrowse already uses (receiving/storage/yard/transportation) —
  rather than a duplicated zone column repeated on every row" (`schema.prisma`
  lines 686-690). "Receiving" specifically has **no backing model at all** —
  it is a real, disclosed, permanently-empty UI zone (`dataProvenance.ts`
  line 55: "Receiving stays a disclosed empty zone since no real model
  exists for it").
- **Assets (as a real, database-backed entity)** — `features/assets/assetsData.ts`
  is a 4-item hardcoded TypeScript array (`forklift-2`, `crane-1`,
  `torque-wrench-12`, `dock-1`). No Prisma model, no route, no API client.
  Confirmed fixture end-to-end by the app's own `dataProvenance.ts` (status:
  `"fixture"`, line 80-85).
- **Maintenance (as an entity)** — only exists as one of three values
  (`active` | `maintenance` | `retired`) of `AssetStatus`, a frontend-only
  TypeScript union in the fixture file above — not a Prisma enum, not a
  schedulable/trackable record of its own.

---

## 4. Entity-by-Entity Schema Inventory

Full field-level detail for every model is in `backend/prisma/schema.prisma`
(cited line ranges below); this section summarizes identifier, required vs.
optional fields, enums, and FKs for each. "Required" means no `?` suffix in
Prisma and no `@default` masking client-supplied absence; "optional" means
`?` or a real, disclosed-honest default.

### RBAC

- **`Module`** (`schema.prisma:38-51`) — id: `String @id` (real stable
  slug, e.g. `"logistics"`). Required: `id`, `name`. No optional fields.
  13 real rows exist, seeded by `prisma/seed.ts:28-64` (see §7 for the full
  list — this is not a Postgres enum, it's real queryable data).
- **`Role`** (`53-61`) — id: `cuid()`. Required: `name` (unique). 10 real
  rows seeded (`seed.ts:96-289`): CEO, Administrator, Manufacturing
  Engineer, Robotics Engineer, Factory Manager, Dispatcher, Superintendent,
  Architect, Project Manager, Investor.
- **`Permission`** (`63-71`) — id: `String @id`, real stable slug. 6 real
  rows: `read`, `create`, `update`, `delete`, `execute`, `administer`
  (`seed.ts:68-75`).
- **`RolePermission`** (`73-84`) — junction table, `@@unique([roleId, moduleId, permissionId])`. No optional fields — every row is a real, specific grant.
- **`User`** (`86-115`) — id: `cuid()`. Required: `email` (unique),
  `displayName`, `roleId` (FK → Role), `passwordHash` (Argon2, never raw).
  Optional: none at schema level. **Real accounts are never seeded in
  `seed.ts`** — created only via the interactive CLI
  `backend/scripts/create-user.ts` (masked password prompt), per the
  schema's own comment (line 94-97), specifically so no even-hashed
  credential is ever checked into git.
- **`UserPreference`** (`124-137`) — id = `userId` (1:1 with User). All 5
  content fields (`workspaceJson`, `appearanceJson`, `notificationsJson`,
  `accessibilityJson`, `preferencesJson`) are nullable JSON blobs — absence
  is a real state (user never touched that panel section), not a gap.
- **`RefreshToken`** (`145-164`) — id: `cuid()`. Required: `userId` (FK),
  `tokenHash` (unique, SHA-256 of the real token — raw token never stored),
  `expiresAt`. Optional: `revokedAt` (null = still valid; non-null once a
  real refresh/logout retired it — a revoked token is never deleted, so
  reuse is detectable).

### Manufacturing → Factory instructions

- **`InstructionSet`** (`170-195`) — id: `cuid()`. Required:
  `sourceObjectId`, `generatedAt`. Optional: `elementSpecJson`,
  `fabricationNotesJson` (both real-when-present, absent for
  building-level/representative runs). `@@unique([sourceObjectId, generatedAt])` — enables idempotent upsert, not a client-minted id.
- **`InstructionStep`** (`206-255`) — id: `cuid()`. Required:
  `instructionSetId` (FK), `sequence` (Int), `targetSubsystemId`,
  `realCommandTarget`, `targetType` (free string today: `"robot"` |
  `"gantry"` | `"roller"` | `"tilt"` | `"atc"` | `"rail"` — **not a Prisma
  enum**, confirmed by the schema field being typed `String`, line 220),
  `action`, `estimatedDurationSec`. Optional: `relatedObjectId`,
  `dispatchJson`, `codeJson`, `reachabilityIssue`. Enum: `status`
  (`InstructionStepStatus`, currently exactly one real value, `planned`
  — schema comment at line 197-203 is explicit that `"executing"`/
  `"complete"` are not real values yet, deliberately).
- **`InstructionExecution`** (`261-282`) — id: `cuid()`. Required:
  `instructionStepId` (FK), `userId` (FK), `ok` (Boolean),
  `commandsJson` (real per-command result array). Optional:
  `twinFrameAtDispatch`. **No direct create route** — always created as a
  side effect of `POST /instruction-executions`, which upserts
  InstructionSet + InstructionStep + InstructionExecution together in one
  call (`backend/src/routes/instructionExecutions.ts:14-38`, full request
  schema).

### Factory collision monitor

- **`MonitoringSession`** (`289-297`) — id: `cuid()`. Required:
  `startedAt` (defaults `now()`). Optional: `endedAt`.
- **`CollisionEvent`** (`299-327`) — id: `cuid()`. Required: `monitoringSessionId` (FK), `subsystemA`, `subsystemB`, `startFrame`, `endFrame`, `maxPenetration` (Float, real measured depth), `samples` (Int), `ongoing` (Boolean), `persistent` (Boolean — "true while the contact held in every snapshot since monitoring began," line 321-324). No optional fields.
- **Zero API routes exist for either model** (confirmed: no route file
  references `monitoringSession` or `collisionEvent`). The real, live
  collision monitor (`features/factory/collisionStore.ts`, confirmed present
  in the frontend) computes everything in-memory from Factory Runtime's
  polled state and never persists to these tables.

### Construction

- **`ConstructionProject`** (`332-349`) — id: `String @id`, real stable
  natural key (e.g. `"cedarwood"`), not a surrogate. Required: `title`.
  Optional: `realLocationSource` (a real citation string when a location
  source exists, e.g. `'garden_lofts_params_v2.json: PROJECT.LOCATION = "Lewisville, Texas"'` — null for 3 of 4 real projects, honestly, not
  guessed). 4 real rows seeded (§7).
- **`ConstructionSite`** (`351-368`) — id = `projectId` (1:1). Optional:
  `address`, `coordsX`, `coordsZ`. **Deliberately no seeded rows at all**
  (schema comment 356-366: no real static fixture has real
  address/coordinates for any of the 4 projects; seeding an all-null row
  would fabricate a "site exists" record). No `precision` column —
  deliberately computed in the application layer, never stored (comment
  361-365, to prevent drift).
- **`ConstructionTreeNode`** (`374-396`) — id: `String @id` (real fixture
  id, e.g. `"cedarwood-building-b"`). Self-referential adjacency list
  (`parentId` optional). Required: `projectId` (FK), `title`, `objectType`
  (free `String`, real values today: `"Project"` | `"Building"` | `"Floor"`
  | `"Floor Plans"` — **not a Prisma enum**). Optional: `progress`, `trade`,
  `inspector`, `punchListCount` (all null for navigational-only nodes, never
  a fabricated placeholder — the seed uses a literal `NO_PROGRESS` constant
  of `"No progress data yet"`/`"—"`/`"Unassigned"`/`"0"` for nodes with no
  real inspection data, `seed.ts:379-384`). 66 real rows seeded (§7).
- **`ProjectFile`** (`415-473`) — id: `cuid()`. Required: `projectId` (FK),
  `treeNodeId` (**not a Prisma FK** — validated against a frontend fixture
  id list at the API layer instead, per the schema's own disclosure, line
  423-427), `category` (free `String` at the schema level, but a real,
  closed, code-enforced vocabulary of **9 values** —
  `PROJECT_FILE_CATEGORIES` in `backend/src/services/projectFileService.ts`:
  `"Project Documents"`, `"Drawings & Models"`, `"Field Documentation"`,
  `"Quality & Safety"`, `"RFI"`, `"Submittal"`, `"Change Order"`,
  `"Inspection Report"`, `"Purchase Order"`. **Correction to this report's
  own earlier draft**: the schema's own comment only names the first 4 as
  the real Browse "folder" groupings and cites `"RFI"` as an example
  *subcategory* value, which understated the real vocabulary — the actual
  `isProjectFileCategory()` type guard in the service file confirms all 9
  are real, valid `category` values, not 4 categories plus free-text
  subcategories. Verified by reading the real constant directly, not the
  schema comment alone.), `fileId` (uuid, stable across
  versions), `version` (Int, default 1), `originalFilename`, `contentType`,
  `sizeBytes`, `s3Key` (unique), `uploadedById` (FK). Optional:
  `subcategory` (free text, not part of the closed vocabulary above),
  `deletedAt`/`deletedById` (soft delete only, S3 object
  never removed). **Zero seeded rows** — "no real document data exists yet
  to migrate" (line 412-414).

### Genealogy

- **`GenealogyNode`** (`491-503`) — id: `String @id` (real fixture id, e.g.
  `"lgs-0041"`). Required: `title`, `tier` (enum `GenealogyTier`: `material`
  | `framing_package` | `component` | `subassembly` | `module` | `building`
  | `project` — 7 values, `481-489`). Optional: `qr` (absent for
  Module/Building/Project tiers, "no real thread has built one yet" at
  those tiers).
- **`GenealogyEdge`** (`505-515`) — `@@unique([fromId, toId])`. A true DAG,
  not a tree — the schema's own comment (475-479) is explicit that a
  `parent_id` column would silently collapse the real multi-parent shape
  (one seeded node, `ewp-03-s`, has 5 real incoming edges).
- 13 nodes / 12 edges real-seeded (§7) — **but zero API routes exist**
  (confirmed: no route file references `genealogyNode` or `genealogyEdge`).
  The frontend's Genealogy feature reads a wholly separate static fixture,
  `features/genealogy/graphData.ts`, never this table. See §12 for why this
  matters.

### Scheduling — pipeline taxonomy (structural, no dates)

- **`ScheduleStage`** (`537-554`) — id: `String @id`, 5 real values
  (`inbound-material`, `material-arrival`, `subassembly-module`,
  `storage-logistics`, `construction-schedule`, per the schema comment at
  line 538-539). Optional: `ownedByModuleId` (FK → `Module`, null = "genuinely no owning module yet," a real disclosed gap, not a placeholder — `inbound-material` is the one stage with no owner).
- **`SchedulePort`** (`556-576`) — Required: `stageId` (FK), `portKey`
  (unique within stage only, not globally), `label`, `direction` (enum
  `PortDirection`: `input` | `output`). `type` defaults to the string
  `"BOOL"` — the only real port-type value today (line 567-569).
- **`ScheduleWire`** (`581-589`) — port-to-port edges only, `fromPortId`/`toPortId` FKs.

### Scheduling — real task instances (Phase 1 addition, has dates/status)

- **`ScheduleTask`** (`610-642`) — id: `cuid()`. Required: `title`,
  `plannedStart`, `plannedEnd`. Optional: `stageId` (FK → ScheduleStage,
  null = real, valid state), `ownedByModuleId` (FK → `Module`, same
  nullable convention), `actualStart`/`actualEnd` (null until real work
  starts/finishes — never defaulted to the planned date, line 627-629).
  Enum: `status` (`ScheduleTaskStatus`: `planned` | `in_progress` |
  `complete` | `blocked`, default `planned`).
- **`ScheduleTaskDependency`** (`648-658`) — real predecessor→successor DAG
  edges (a task can have more than one of each — not a single
  "previous task" pointer). `@@unique([predecessorId, successorId])`.
- **`ScheduleTaskStatusEvent`** (`663-681`) — audit trail. Required:
  `taskId` (FK), `toStatus`, `changedById` (FK → User), `changedAt`
  (defaults `now()`). Optional: `fromStatus` (null only for a task's own
  creation event), `notes`.

### Logistics

- **`LogisticsMaterial`** (`733-744`) — id: `cuid()`. Required: `name`.
  Optional: `quantity` (Int), `location` (free text, e.g. `"Bay A"`, no
  geocoding implied). **No update/delete route exists** — confirmed via
  `backend/src/routes/logisticsMaterials.ts`, which has exactly `GET` and
  `POST`, nothing else (verified directly, not inferred).
- **`LogisticsModule`** (`746-759`) — id: `cuid()`. Required: `name`.
  Optional: `location` (free text, e.g. `"Yard Row 3"`), `dispatchId` (FK →
  LogisticsDispatch, null while staged with no haul assigned — **the model
  deliberately carries no status column of its own**; lifecycle state is
  derived from whether `dispatchId` is set and that dispatch's own
  `status`, per the schema's explicit design note, line 710-715). Same
  GET+POST-only route surface as LogisticsMaterial
  (`backend/src/routes/logisticsModules.ts`).
- **`LogisticsTruck`** (`761-770`) — Required: `identifier` (unique, e.g.
  `"TRL-118"`). GET+POST only (`logisticsTrucks.ts`).
- **`LogisticsDriver`** (`772-779`) — Required: `name`. GET+POST only
  (`logisticsDrivers.ts`).
- **`LogisticsDispatch`** (`781-855`) — id: `cuid()`. Required: `truckId`
  (FK), `driverId` (FK), `destinationProjectId` (**real FK to
  `ConstructionProject`, deliberately not free text** — schema comment
  692-701 explains this was investigated and decided specifically to avoid
  a dispatch naming a destination that doesn't correspond to any real
  project). Enum `status` (`LogisticsStatus`: `staged` | `in_transit` |
  `delivered`, default `staged`). Optional: `route`/`traffic` (honest
  placeholders — "no real routing/GPS data exists anywhere in this
  codebase," line 716-721), `eta`, `odometerStart`/`odometerEnd` (`miles`
  is always **server-derived** as `odometerEnd - odometerStart`, never
  independently client-supplied, line 819-825), `businessPurpose`,
  `taxReportedAt`/`taxReportedById`. **This entity has the richest write
  surface of any Logistics model**: real create
  (`POST /logistics-dispatches`), real status-transition
  (`PATCH /logistics-dispatches/:id/status`, writes a `LogisticsCustodyEvent`
  in the same transaction), real mileage recording
  (`PATCH /logistics-dispatches/:id/mileage`), real tax-report push
  (`PATCH /logistics-dispatches/:id/tax-report`) — full detail in §6.
- **`MileageRateConfig`** (`870-886`) — Required: `centsPerMile` (Float),
  `effectiveDate`. Optional: `createdById`. Effective-dated (not a single
  "current rate" scalar) because IRS Publication 463 requires applying the
  rate in effect on the trip's own date. **Zero seeded rows** — no specific
  real-world rate is guessed (line 866-869); a real user enters it via the
  API.
- **`LogisticsCustodyEvent`** (`903-924`) — real audit trail, one row per
  real status transition **including the dispatch's own creation** (
  `fromStatus` null, `toStatus` staged) — so full custody history is always
  readable from this table alone, "never everything except the first
  event" (line 899-902).
- **`LogisticsDocument`** (`957-990`) — mirrors `ProjectFile`'s shape
  exactly, scoped to `LogisticsDispatch` specifically (not
  Material/Module/Truck/Driver — a deliberate, disclosed scoping decision,
  schema lines 926-939, since real logistics documents are per-haul, not
  per-truck/driver). `category` drawn from a real closed vocabulary in
  `logisticsDocumentService.ts` (`LOGISTICS_DOCUMENT_CATEGORIES`), not
  quoted from a task brief the way `ProjectFile`'s categories were (this
  provenance difference is explicitly flagged in the schema comment,
  946-952, as worth keeping honest, not silently presented the same way).

### Compliance

- **`ComplianceDocument`** (`1004-1037`) — standalone, deliberately **not**
  FK'd to any project or dispatch (schema comment 992-1002: OSHA
  docs/certifications/licenses are company/employee-wide, a user-confirmed
  decision). `category` free `String` (closed vocab in code: OSHA /
  Certification / License). `subject` free text (see §3 — the only trace of
  an "employee" concept anywhere).

### Networking

- **`NetworkVlan`** (`1094-1105`) — Required: `number` (unique Int),
  `name`, `subnet`. 9 real rows seeded (§7).
- **`NetworkDevice`** (`1107-1133`) — Required: `name`, `role` (enum
  `NetworkDeviceRole`, 22 real values, `1069-1092`). Optional: `model`,
  `ipAddress`, `vlanId` (FK), `uplinkDeviceId` (self-FK, a real tree, no
  redundant/mesh links — a single parent pointer is sufficient, line
  1122-1125). 29 real rows seeded (§7) — a **disclosed, confirmed gap**: the
  source diagram's own topology-summary panel totals 31 devices; only 29
  could be confirmed by name/IP at the screenshot's resolution
  (schema comment 1054-1060). Read-only in the app — no write route exists.

---

## 5. Relationship / Foreign-Key Map

Real FK edges only (self-referential and junction-table edges included),
confirmed directly from `schema.prisma`'s `@relation` declarations:

```
User ──< RefreshToken
User ──< InstructionExecution
User ──< ProjectFile (uploadedBy, deletedBy — 2 distinct relations)
User ──< LogisticsDocument (uploadedBy, deletedBy)
User ──< ComplianceDocument (uploadedBy, deletedBy)
User ──< LogisticsCustodyEvent (changedBy)
User ──< ScheduleTaskStatusEvent (changedBy)
User ──< MileageRateConfig (createdBy)
User ──< LogisticsDispatch (taxReportedBy)
User ── UserPreference (1:1)
User >── Role
Role >── RolePermission <── Module, Permission (3-way junction)

InstructionSet ──< InstructionStep ──< InstructionExecution >── User
MonitoringSession ──< CollisionEvent

ConstructionProject ── ConstructionSite (1:1)
ConstructionProject ──< ConstructionTreeNode (self-referential tree via parentId)
ConstructionProject ──< ProjectFile
ConstructionProject ──< LogisticsDispatch (as destinationProject)
ProjectFile.treeNodeId → ConstructionTreeNode.id — NOT A REAL FK, validated
  at the API layer against a frontend fixture id list only (schema.prisma:423-427)

GenealogyNode ──< GenealogyEdge (fromId, toId — both self-referential, forms a DAG)

ScheduleStage ──< SchedulePort ──< ScheduleWire (fromPort, toPort)
ScheduleStage ──< ScheduleTask (optional)
Module ──< ScheduleStage.ownedByModule (optional)
Module ──< ScheduleTask.ownedByModule (optional)
ScheduleTask ──< ScheduleTaskDependency (predecessor, successor — self-referential DAG)
ScheduleTask ──< ScheduleTaskStatusEvent

LogisticsTruck ──< LogisticsDispatch
LogisticsDriver ──< LogisticsDispatch
LogisticsDispatch ──< LogisticsModule (optional dispatchId)
LogisticsDispatch ──< LogisticsDocument
LogisticsDispatch ──< LogisticsCustodyEvent
LogisticsMaterial — no outgoing or incoming real FK at all (fully standalone)

NetworkVlan ──< NetworkDevice
NetworkDevice ──< NetworkDevice (self-referential, uplinkDevice — a real tree)
```

**Entities with zero real FK connections to anything else**:
`LogisticsMaterial`, `ComplianceDocument` (deliberately, per §4), and both
`GenealogyNode`/`GenealogyEdge` and `MonitoringSession`/`CollisionEvent` as
*groups* (internally connected to each other, but with no FK to/from any
other subsystem — Genealogy nodes don't reference `ConstructionProject`,
`LogisticsMaterial`, or anything Manufacturing-related, despite the
conceptual overlap implied by shared vocabulary like "module"/"material").

**This directly contradicts the "connected enterprise graph" example given
in the investigation brief.** The brief's own example (`Facilities → Zones →
Assets → Materials → Modules → Dispatch activity`, `Employees → Assets →
Projects → Logistics activity`) describes a graph that **does not exist in
the current implementation**. Facilities, Zones, and Employees aren't real
entities at all (§3); Assets is frontend-fixture-only with no FK anywhere;
LogisticsMaterial/LogisticsModule have no FK to Projects or Employees. A
synthetic dataset that produces this exact graph shape would be inventing
relationships, not deriving them from the implementation — flagged per the
brief's own "confirm, don't assume" rule.

---

## 6. API / Import Map

Full route inventory, method + path + permission gate, extracted from a
direct read of every file in `backend/src/routes/` (20 files):

| Route file | Methods & paths | Permission gate |
|---|---|---|
| `auth.ts` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | none (login/refresh/logout are the auth bootstrap itself); `/auth/me` requires a valid session only |
| `users.ts` | `GET/POST /users`, `PATCH/DELETE /users/:id` | `permissions:read`/`create`/`update`/`delete` (verified, `src/routes/users.ts:26-29`) |
| `userPreferences.ts` | `GET/PATCH /user-preferences` | session only, always scoped to the caller's own row |
| `constructionSites.ts` | `GET /construction-sites`, `GET /construction-sites/:projectId`, `PUT`+`PATCH /construction-sites/:projectId`, `DELETE /construction-sites/:projectId` | `construction:*` |
| `projectFiles.ts` | `GET/POST /construction-files`, `GET .../download`, `GET/POST .../versions`, `PATCH/DELETE /construction-files/:fileId` | `construction:*` |
| `complianceDocuments.ts` | same CRUD+versions+download shape as projectFiles, path `/compliance-documents` | `administration:read`/`create`/`update`/`delete` (verified, `src/routes/complianceDocuments.ts:45-48`) |
| `logisticsMaterials.ts` | `GET/POST /logistics-materials` only — **no update/delete** | `logistics:read`/`logistics:create` |
| `logisticsModules.ts` | `GET/POST /logistics-modules` only — **no update/delete** | `logistics:read`/`logistics:create` |
| `logisticsTrucks.ts` | `GET/POST /logistics-trucks` only — **no update/delete** | `logistics:read`/`logistics:create` |
| `logisticsDrivers.ts` | `GET/POST /logistics-drivers` only — **no update/delete** | `logistics:read`/`logistics:create` |
| `logisticsDispatches.ts` | `GET/POST /logistics-dispatches`, `PATCH .../:id/status`, `GET .../:id/events`, `PATCH .../:id/mileage`, `PATCH .../:id/tax-report`, `GET /logistics-mileage-tax-report` | `logistics:read`/`create`/`update` per route |
| `logisticsDocuments.ts` | full CRUD+versions+download, path `/logistics-files` | `logistics:*` |
| `logisticsKpis.ts` | `GET /logistics-kpis` only | `logistics:read` |
| `mileageRates.ts` | `GET/POST /mileage-rates` — **no update/delete** | `logistics:read`/`create` |
| `network.ts` | `GET /network-topology` only — read-only, matches §4's finding | `networking:read` |
| `rbacDirectory.ts` | `GET /rbac-directory`, `PATCH /rbac-directory/grants` | `permissions:read`/`permissions:update` |
| `scheduleTasks.ts` | `GET/POST /schedule-tasks`, `PATCH /schedule-tasks/:id`, `PATCH .../:id/status`, `DELETE /schedule-tasks/:id`, `POST /schedule-task-dependencies` | full CRUD + a real status-transition sub-route |
| `instructionExecutions.ts` | `POST /instruction-executions` (compound upsert, see §4), `GET /instruction-executions?targetSubsystemId=` | `factory:execute` (write), `analytics:read` (read) — deliberately different modules for write vs. read |
| `manufacturingModel.ts` | `GET /manufacturing-model/download-url` only | **none — explicitly unauthenticated**, disclosed in the route's own comment as "Manufacturing has no backend-enforced permission story at all yet" |
| `system.ts` | `GET /system/ready` | none (deliberately public, same reasoning as `/health`) |
| `health.ts` | `GET /health` | none |

**No bulk/batch/CSV/JSON import endpoint exists anywhere.** The only
multi-row write mechanism in the entire codebase is `prisma/seed.ts`
(§7) — a script, not an API, run via `npm run prisma:seed`, never exposed
over HTTP.

**Genealogy, InstructionSet/InstructionStep (as standalone creates), Role,
Permission, Module, MonitoringSession, and CollisionEvent have zero direct
CRUD routes.** Role/Module/Permission are read/written only indirectly
through `rbac-directory`'s grant-level PATCH; the rest have no route at all
(confirmed by grep across every route file for each model name).

---

## 7. Seed / Mock / Demo Data Inventory

Full inventory from a complete read of `backend/prisma/seed.ts` (670 lines).
Two independently callable phases:

**`seedRbac()`** (always runs; `--rbac-only` flag skips the second phase) —
generic to any FF deployment, explicitly safe for a customer pilot database
per the script's own comment (line 523-527, cross-referencing
`AI_Dispatch/scripts/onboard-ff-pilot.sh`):
- 13 `Module` rows (manufacturing, factory, robotics, logistics,
  construction, genealogy, scheduling, assets, analytics, reports,
  administration, permissions, networking)
- 6 `Permission` rows (read, create, update, delete, execute, administer)
- 10 `Role` rows (CEO, Administrator, Manufacturing Engineer, Robotics
  Engineer, Factory Manager, Dispatcher, Superintendent, Architect, Project
  Manager, Investor)
- A full `RolePermission` matrix — every role × every module, per an
  explicit, individually-commented grant table (`seed.ts:96-289`). Notable
  disclosed ambiguity: Robotics Engineer's grant on `robotics` was revised
  to include `execute` but the brief's wording on whether it should also
  include `administer` was genuinely ambiguous — resolved to **not** grant
  `administer`, flagged in the script's own comment as "not silently
  decided" (line 138-156).

**`seedFixtures()`** (Construction-Enterprises-specific; the script's own
comment says this must never run against a customer pilot DB):
- 13 `GenealogyNode` + 12 `GenealogyEdge` rows — the real Cedarwood Flats
  exterior-wall-panel DAG, ported verbatim from
  `frontend/src/features/genealogy/graphData.ts` (seed.ts:291-337). Node
  `ewp-03-s` has the real 5-incoming-edge multi-parent shape.
- 4 `ConstructionProject` rows: Stonepine Residences, Cedarwood Flats,
  Garden Lofts, Skyline Towers (`seed.ts:345-354`) — only Garden Lofts has a
  real `realLocationSource` citation.
- 66 `ConstructionTreeNode` rows total: 4 project roots + 1 Stonepine
  "Floor Plans" placeholder + 5 Cedarwood buildings (A–E, only A/B have real
  progress data, C/D/E honestly null) + 20 Garden Lofts floors + 40 Skyline
  floors (`seed.ts:386-424`).
- 9 `NetworkVlan` rows (VLANs 10–90) + 29 `NetworkDevice` rows, a real
  topology tree rooted at one Edge Firewall (`seed.ts:436-521`).

**Deliberately zero seeded rows**, confirmed by explicit comments in the
schema and/or seed script for each: `User` (created only via
`scripts/create-user.ts`, an interactive CLI — never in git-committed
seed data, even hashed), `ConstructionSite`, `ProjectFile`,
`LogisticsMaterial`/`Module`/`Truck`/`Driver`/`Dispatch`,
`MileageRateConfig`, `LogisticsDocument`, `ComplianceDocument`,
`InstructionSet`/`Step`/`Execution`, `MonitoringSession`/`CollisionEvent`,
`ScheduleTask`/`TaskDependency`/`TaskStatusEvent`. `ScheduleStage`/`Port`/
`Wire` (the structural pipeline taxonomy) were not found seeded in
`seed.ts` either — not confirmed present as database rows by this pass;
the frontend's `scheduleData.ts` fixture may be the only place this
structure currently exists (flagged as unconfirmed, not asserted either
way — the seed script's own console-log summary at lines 555-646 never
mentions Stage/Port/Wire counts, which is suggestive but not conclusive).

---

## 8. Real Backend vs. Hardcoded UI Analysis

The frontend has its own internal source-of-truth file for exactly this
question: `Factory_To_Foundation/frontend/src/features/administration/dataProvenance.ts`.
It predates several later builds (see the inconsistency noted below) but is
a real, deliberately-maintained table, not this report's invention. Its
own stated statuses, cross-checked against the routes/schema findings above:

| Feature | App's own claimed status | Cross-check against this pass |
|---|---|---|
| Genealogy | `real-static` ("one real thread, not live production data") | **Consistent but incomplete**: the source it cites (`graphData.ts`) is correct, but the file doesn't mention that a real, separately-seeded `GenealogyNode`/`GenealogyEdge` table also exists in Postgres and is never read (§4/§12) |
| Factory | `real-live` | Consistent — reads Factory Runtime, not this report's scope |
| Robotics | `real-structure-fixture-values` | Consistent — no Prisma model for Robotics exists at all |
| Logistics | `real-live` | Consistent, and specific: "Storage/Yard/Transportation zones show whatever real rows actually exist... Receiving stays a disclosed empty zone since no real model exists for it" — matches §3/§4 exactly |
| Construction | `real-structure-fixture-values` | Consistent with `ConstructionTreeNode`'s mixed real/honest-null progress data (§4, §7) |
| Manufacturing | `real-static` | Consistent — no Prisma model, real S3-backed geometry pipeline instead (§4) |
| Scheduling | `real-static`, described as "no execution engine, no live values flow through the wires" | **Likely stale.** `ScheduleTask`/`TaskDependency`/`TaskStatusEvent` (real dates, real status, real dependency DAG, full CRUD route) were added in a later phase (`schema.prisma:591-601` dates this "Phase 1, Networking/Settings/Analytics build") and are not mentioned in this file at all. Flagged as an inconsistency, not silently reconciled — see §12. |
| Assets | `fixture` | Consistent — confirmed in §3/§4 |

**Not covered by `dataProvenance.ts` at all** (added after it was last
updated, or out of its original scope): Compliance, Permissions/RBAC
directory, Networking, Mileage tracking, Instruction executions. All of
these were confirmed real (Prisma-backed, real routes) directly in §4/§6
of this report.

**Feature directories confirmed to have a real backend API client**
(`<name>Api.ts` file present, grep-confirmed):
`administration/complianceDocumentsApi.ts`,
`construction/projectFilesApi.ts`,
`factory/instructionExecutionsApi.ts`,
`logistics/logisticsDocumentsApi.ts`, `logistics/logisticsOperationsApi.ts`,
`networking/networkApi.ts`, `permissions/rbacDirectoryApi.ts`,
`permissions/userManagementApi.ts`, `scheduling/scheduleTasksApi.ts`,
`settings/settingsApi.ts` (10 files, 8 distinct feature directories).

**Feature directories with no such API client**: `genealogy` (fixture),
`robotics` (fixture), `assets` (fixture), `manufacturing` (has real
geometry via a different mechanism, not this pattern), `factory` (uses
`useTwinState`/`useTwinManifest` against Factory Runtime directly, a
different real mechanism than the Postgres-backed API pattern).

**`reports`/`analytics` are not their own entities — both are aggregator
dashboards, mixing real and fixture sources with no clean single-status
label.** Confirmed by reading their import lists directly:
`AnalyticsDashboard.tsx` imports real data from `useTwinManifest`/
`useTwinState` (Factory Runtime), `instructionExecutionsApi.ts` (real
backend API), and `scheduleTasksApi.ts` (real backend API) — **alongside**
fixture data from `genealogy/graphData.ts`, `construction/constructionData.ts`,
and `scheduling/scheduleData.ts`, combined in one dashboard.
`ReportsLibrary.tsx` similarly mixes a real source (`collisionStore.ts`,
live Factory Runtime polling) with fixture `constructionData.ts`. Neither
file has, or would sensibly have, its own Prisma model — they're
presentation-layer aggregations of the entities already cataloged above,
not additional entities a synthetic-data spec would need to model
separately.

---

## 9. Authentication / Permission Considerations for Data Creation

- Every write route in the inventory above (§6) requires
  `authenticate` + `requirePermission(moduleId, permissionId)` as Fastify
  preHandlers (`backend/src/middleware/auth.ts`, full file read) — **except**
  `manufacturingModel.ts`'s presigned-URL route (explicitly, disclosedly
  unauthenticated) and the bootstrap/health/readiness routes
  (`auth.ts`'s own login/refresh/logout, `health.ts`, `system.ts`).
- `authenticate` verifies a JWT from the `ff_access_token` httpOnly cookie
  and populates `request.user = { id, roleId, roleName }`. There is **no
  API-key or service-account mechanism** anywhere in the codebase — any
  synthetic-data pipeline calling the real API would need to authenticate
  as a real seeded `User` via `POST /auth/login` (email + password) and
  carry the resulting session cookie, exactly like the real frontend does.
  No bypass or bulk-write credential exists.
- Real accounts can only be created via the interactive CLI
  `backend/scripts/create-user.ts` (masked password prompt) — **not**
  scriptable non-interactively without modification, and not via any API
  route (no `POST /users`-style self-service signup exists; `users.ts`'s
  `POST /users` route itself requires an authenticated caller with the
  relevant create permission — i.e., an admin creating another user, not a
  bootstrap mechanism).
- Every `RolePermission` grant is real, specific, per-module data (§7) —
  a synthetic-data-generation service account would need a real `Role`
  whose grants actually cover every module/action it intends to write to.
  The seeded `CEO` role has `FULL` (all 6 actions) on all 13 modules
  (`seed.ts:96-102`) and is the only role with universal write access.

---

## 10. Existing Test Fixtures / Factories

**None exist.** Confirmed by a repo-wide search across both `backend/` and
`Factory_To_Foundation/frontend/src/` for `*.test.ts`, `*.test.tsx`,
`*.spec.ts`, `*.spec.tsx`, and any file/directory name containing `fixture`
or `factory` (case-insensitive) — zero matches beyond `prisma/seed.ts`
itself and the frontend's own domain-fixture files already cataloged in §3/
§7/§8 (`assetsData.ts`, `graphData.ts`, `constructionData.ts`,
`roboticsData.ts`, `scheduleData.ts` — these are real application fixture
data, not test fixtures). No test runner (Jest/Vitest/etc.) dependency was
observed in `backend/package.json`'s scripts section either — only
`typecheck`, `prisma:*`, `dev`, `create-user`, `reset-password`.

---

## 11. Data-Generation Dependency Ordering

Derived from the real migration sequence
(`backend/prisma/migrations/`, timestamp order) and the FK map in §5 —
this is the order real tables came into existence, which is also a valid
topological order for seeding (each migration's new FKs only ever point at
tables from an earlier migration):

1. `20260724184947_init` — RBAC core (Module/Role/Permission/RolePermission/
   User), InstructionSet/Step/Execution, MonitoringSession/CollisionEvent,
   Construction (Project/Site/TreeNode), Genealogy, Scheduling taxonomy
   (Stage/Port/Wire)
2. `20260725040848_phase3b_auth` — RefreshToken
3. `20260725234815_construction_document_management` — ProjectFile
4. `20260726102834_logistics_phase4_data_model` — Material/Module/Truck/
   Driver/Dispatch
5. `20260726215654_logistics_phase5_documents` — LogisticsDocument
6. `20260726222541_logistics_dispatch_eta` — (column addition to Dispatch,
   not a new table)
7. `20260726234934_logistics_phase7_custody_events` — LogisticsCustodyEvent
8. `20260731083046_networking_settings_analytics_phase1` — verified via
   `migration.sql`: `ScheduleTask`/`TaskDependency`/`TaskStatusEvent`,
   `UserPreference`, `ComplianceDocument` (5 real `CREATE TABLE`
   statements, confirmed directly, not inferred from the migration name)
9. `20260731120000_permissions_rename_and_networking_module` — the RBAC
   module-id rename (§7) **plus** `NetworkVlan`/`NetworkDevice` (verified
   via `migration.sql` — despite the earlier-dated migration's name
   suggesting "networking," the actual network tables were created here,
   one migration later; corrected in this report after an initial
   name-based assumption was checked against the real SQL and found wrong)
10. `20260807200224_logistics_mileage_tracking` — MileageRateConfig,
    Dispatch.odometerStart/End/miles/businessPurpose columns
11. `20260808043542_logistics_mileage_tax_report` — Dispatch.taxReportedAt/
    taxReportedById columns

**A safe generation order for any future synthetic dataset**, respecting
every real FK in §5: `Module`/`Permission`/`Role` → `User` (needs `Role`) →
`RolePermission` → `ConstructionProject` → `ConstructionSite`/
`ConstructionTreeNode` (need Project) → `ProjectFile` (needs Project + User)
→ `LogisticsTruck`/`Driver`/`Material` (no dependencies) →
`LogisticsDispatch` (needs Truck + Driver + ConstructionProject) →
`LogisticsModule`/`LogisticsDocument`/`LogisticsCustodyEvent` (need
Dispatch) → `MileageRateConfig` (needs User, optional) → `ScheduleStage`
(needs Module, optional) → `SchedulePort`/`Wire` (need Stage) →
`ScheduleTask` (needs Stage + Module, both optional) →
`ScheduleTaskDependency`/`StatusEvent` (need Task + User) →
`GenealogyNode` → `GenealogyEdge` → `NetworkVlan` → `NetworkDevice` (needs
Vlan, optional; self-FK needs parent-first order, per `seed.ts`'s own
comment at line 621-622) → `ComplianceDocument` (needs User) →
`InstructionSet` → `InstructionStep` → `InstructionExecution` (needs Step +
User) → `MonitoringSession` → `CollisionEvent` (needs Session).

---

## 12. Ambiguities and Inconsistencies

Documented explicitly, per the brief's instruction not to silently
reconcile any of these:

1. **"Module" means four different things.** The RBAC `Module` table (13
   rows: manufacturing, factory, logistics, etc.) is unrelated to
   `LogisticsModule` (a real yard/dispatch entity) and unrelated to
   `GenealogyTier`'s `module` value (a tier in the material→project
   hierarchy). The schema's own comment (`schema.prisma:702-709`)
   discloses this as a genuinely open question it deliberately did not
   resolve: "CLAUDE.md gap #12 leaves open whether a Manufacturing 'unit'
   and a Scheduling 'module' are even the same concept." A synthetic-data
   spec must pick one meaning per context and must not silently unify them.
2. **"Material" means two different things.** `LogisticsMaterial` (Storage
   zone inventory) vs. `GenealogyTier`'s `material` value (raw stock
   feeding a framing package). No FK connects them.
3. **Genealogy's real database table is orphaned from the running app.**
   Real seeded rows exist (§7); zero routes read them (§6); the frontend
   uses a completely separate static fixture instead (§8). Any synthetic
   data written to `GenealogyNode`/`GenealogyEdge` today would be
   invisible to the actual application — worth surfacing before any
   generation work targets this table.
4. **Same disconnection pattern for `MonitoringSession`/`CollisionEvent`.**
   Real schema, zero routes, frontend computes everything client-side and
   in-memory instead (§4).
5. **`dataProvenance.ts` (the app's own real-vs-fixture source of truth) is
   at least one phase stale** on Scheduling specifically — it describes
   "no execution engine, no live values" for a feature that, per the schema
   and routes, now has a real dated/statused task model with full CRUD
   (§8). Not silently corrected in this report; flagged as a real
   inconsistency between the app's own documentation and its own code.
6. **`ScheduleStage`/`SchedulePort`/`ScheduleWire` seed status is
   unconfirmed.** `seed.ts`'s console-log summary (lines 555-646) never
   reports counts for these three tables, unlike every other seeded group
   — genuinely unclear from this pass whether they have real seeded rows
   at all, or whether the pipeline-taxonomy structure currently only lives
   in the frontend's `scheduleData.ts` fixture. Flagged as unconfirmed, not
   asserted either way.
7. **`ProjectFile.treeNodeId` is not a real foreign key**, despite
   `ConstructionTreeNode` being a real Prisma model — it's validated
   against a frontend fixture id list at the API layer instead (§4/§5,
   `schema.prisma:423-427`, disclosed by the schema's own comment as
   deliberate, not an oversight, since `ConstructionTreeNode` "is a
   frontend fixture... deliberately still not migrated to real backend
   reads this phase"). Wait — this is itself a further inconsistency worth
   naming precisely: `ConstructionTreeNode` **is** a real Prisma model with
   real seeded rows (§4/§7), which appears to contradict the comment
   calling it "a frontend fixture." Both things are true simultaneously in
   different senses (a real table exists AND the frontend's live Browse
   tree still reads its own separate fixture, `constructionData.ts`, not
   this table) — the same orphaned-table pattern as Genealogy (#3 above),
   not independently resolved by this report.
8. **The investigation brief's example enterprise graph does not match the
   real implementation.** See the callout at the end of §5.
9. **Several conceptual gaps are pre-disclosed in the app's own code as
   "gap #N"** (e.g., "CLAUDE.md gap #2" for Inbound Material's missing
   owner, "gap #4" for the Logistics KPI row's fixture status, "gap #11"
   for a disclosed 272-vs-340 Manufacturing unit-count discrepancy, "gap
   #12" for the Module/Material ambiguity above, "gap B7" for the missing
   Employee/equipment table). This report did not have access to a
   canonical numbered gap list (no file named exactly that was located in
   this pass) — these are cited exactly as the code comments reference
   them, not expanded or verified against a separate gap-tracking document.

---

## 13. Recommended Bulk-Loading Strategy

**Not implemented in this pass, per the brief's explicit instruction.**
Observations relevant to a future design decision, grounded in what
actually exists today (§6):

- **No import endpoint exists** — the only two real write paths are (a)
  per-entity REST `POST`/`PATCH` routes, each individually authenticated
  and permission-gated, or (b) `prisma/seed.ts`-style direct Prisma Client
  upserts run as a script against the database, bypassing the API/auth
  layer entirely.
- A generator targeting the real API (path (a)) would need to: authenticate
  as a real `CEO`-role user (§9), respect every required field and real FK
  per §4, and — for the several entities with GET+POST-only routes
  (LogisticsMaterial/Module/Truck/Driver, MileageRateConfig) — accept that
  no update/delete path exists for correcting a bad generated row via the
  API; only direct DB access could fix that.
- A generator targeting Prisma directly (path (b), matching `seed.ts`'s own
  precedent) bypasses all auth/permission logic entirely — real risk if
  ever pointed at a non-scratch database, same caution the existing seed
  script itself takes explicit pains to explain (`--rbac-only`'s existence,
  the "never run fixtures against a customer pilot DB" comment,
  `seed.ts:523-527`).
- Whichever path is chosen, `@@unique` constraints already present in the
  schema (e.g. `InstructionSet`'s `[sourceObjectId, generatedAt]`,
  `LogisticsCustodyEvent`'s implicit one-row-per-transition design) suggest
  idempotent upsert is the established pattern in this codebase, not
  insert-only.

---

## 14. Recommended First Synthetic Dataset

**Not designed in this pass, per the brief's explicit instruction.** Left
for the next phase, once Joshua has reviewed this report and the
ambiguities in §12 (particularly the Module/Material overloading and the
orphaned-Genealogy-table question) are either resolved or deliberately
scoped around.

---

## 15. Files Inspected

**Full reads:**
- `backend/prisma/schema.prisma` (1133 lines, complete)
- `backend/prisma/seed.ts` (670 lines, complete)
- `backend/src/middleware/auth.ts`
- `backend/src/routes/manufacturingModel.ts`
- `backend/src/routes/rbacDirectory.ts`
- `backend/src/routes/logisticsDispatches.ts`
- `backend/src/routes/logisticsKpis.ts`
- `backend/src/routes/instructionExecutions.ts`
- `Factory_To_Foundation/frontend/src/features/assets/assetsData.ts` (head)
- `Factory_To_Foundation/frontend/src/features/administration/dataProvenance.ts` (complete)

**Directory listings / structural checks:**
`backend/src/{routes,repositories,services}/`, `backend/scripts/`,
`backend/prisma/migrations/`, `Factory_To_Foundation/frontend/src/`
(top level and `features/` subdirectories), `docs/` (repo root, did not
exist prior to this report).

**Targeted greps (pattern matches, not full file reads)** across
`backend/src/routes/*.ts` (HTTP method + path extraction, two passes —
the first single-line regex undercounted multi-line route registrations,
corrected with a multiline-aware pattern) and across
`Factory_To_Foundation/frontend/src/` for: `employee`, `facility`,
`maintenance`, `zone`, `receiving`, `yard`, `personnel`/`people`,
`*Api.ts` file names, `*.test.ts`/`*.spec.ts`/`*fixture*`/`*factory*` file
names (backend and frontend), `bulk`/`import` (backend, low signal — matched
routine JS `import` statements, not a real bulk-import feature; no such
feature found).

**Second-pass verification, added after the initial draft** (per the
brief's own instruction to re-check load-bearing findings before
finishing): re-grepped `prisma/seed.ts` for `scheduleStage`/`schedulePort`/
`scheduleWire` (confirmed absent, §11 item 6 stands); read the exact
`requirePermission` grants in `users.ts` and `complianceDocuments.ts`
(§6 table corrected from "not confirmed" to real values:
`permissions:*` and `administration:*` respectively); read the import
lists of `ReportsLibrary.tsx` and `AnalyticsDashboard.tsx` in full (§8
upgraded from "unconfirmed" to a specific real+fixture breakdown); read
the actual `CREATE TABLE` statements in
`20260731083046_networking_settings_analytics_phase1/migration.sql` and
found the network tables were **not** in it despite the migration's name —
they're in the next migration instead (§11 corrected, a real error caught
and fixed by this verification pass, not left standing).

**Not read in this pass** (named for completeness, not silently skipped):
individual repository/service files beyond those listed above (route files
were treated as authoritative for the API surface; service/repository
internals were not independently re-verified line by line except where
cited), the full contents of `roboticsData.ts`/`scheduleData.ts`/
`constructionData.ts`/`graphData.ts` (existence and role confirmed via
`dataProvenance.ts`, targeted greps, and the import-list checks above, not
read end to end), `backend/src/lib/s3.ts`, `backend/src/server.ts`.
