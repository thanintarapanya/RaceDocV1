# Graph Report - RaceDocV1Github  (2026-05-22)

## Corpus Check
- 52 files · ~66,577 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 355 nodes · 400 edges · 16 communities detected
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]

## God Nodes (most connected - your core abstractions)
1. `finishSave()` - 18 edges
2. `useAuth()` - 7 edges
3. `getAuthErrorMessage()` - 7 edges
4. `RacedocV1` - 5 edges
5. `refreshDetail()` - 4 edges
6. `prefillInspectionAnswers()` - 4 edges
7. `uploadEntryAsset()` - 4 edges
8. `uniqueValues()` - 4 edges
9. `uploadOrganizerAsset()` - 4 edges
10. `normalizePayload()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `RacedocV1` --indexes--> `Graphify`  [INFERRED]
  RaceDocV1_Architecture.md → AGENTS.md
- `ProtectedRoute()` --calls--> `useAuth()`  [INFERRED]
  src/auth/ProtectedRoute.tsx → src/auth/useAuth.ts
- `useAuth()` --calls--> `ScrutineerReportRoute()`  [INFERRED]
  src/auth/useAuth.ts → src/auth/RoleGate.tsx
- `useAuth()` --calls--> `OnboardingRoute()`  [INFERRED]
  src/auth/useAuth.ts → src/auth/OnboardingRoute.tsx
- `useAuth()` --calls--> `AuthRedirect()`  [INFERRED]
  src/auth/useAuth.ts → src/auth/AuthRedirect.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (55): countReady(), createBallastRuleForm(), createCircuitForm(), createEmptyBallastRuleForm(), createEmptyCircuitForm(), createEmptyEventForm(), createEmptyEventSeriesRuleForm(), createEmptyGradeForm() (+47 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (17): createInitialEntryFormState(), createPersonalSnapshot(), draw(), getCanvasPoint(), handleDocumentUpload(), handleSignatureUpload(), handleSubmitBatch(), loadOptions() (+9 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (14): createInspectionFilePath(), createInspectionForm(), flattenSnapshot(), normalizeLabel(), openInspectionForm(), prefillInspectionAnswers(), refreshDetail(), refreshEntries() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (3): addReviewerDraft(), removeReviewerDraft(), updateReviewerDraft()

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (11): AuthRedirect(), OnboardingRoute(), ProtectedRoute(), AdminOnlyRoute(), AdminOrSecretaryRoute(), ScrutineerReportRoute(), useAuth(), canSeeAdminNavigation() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (8): getAuthErrorMessage(), handleEmailLogin(), handleGoogleLogin(), handleSubmit(), validateIdentity(), updatePassword(), handleSignUp(), handleSubmit()

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (6): calculateItemWeight(), createInspectionVersionDiff(), getSelectedValues(), getSingleSelectedValue(), isAnswerFilled(), mapReviews()

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (4): getInvitationNotice(), inviteRoleByEmail(), resendInvitation(), sendRoleInvitation()

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (5): clean(), loadInitialProfile(), saveProfile(), loadInitialData(), normalizePayload()

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (3): normalizePrintOptions(), confirmPrintBackground(), loadPrintOptions()

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (8): Graphify, Balance of Performance (BOP), Entry Form, Inspection Form, RacedocV1, Success Ballast, Supabase, Weight-In

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (3): handleNotificationClick(), refreshNotifications(), getNotificationTargetPath()

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (1): Audit Trail

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (1): RBAC

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (1): Competitor Request

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (1): Branding

## Knowledge Gaps
- **8 isolated node(s):** `Entry Form`, `Success Ballast`, `Audit Trail`, `RBAC`, `Competitor Request` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 39`** (1 nodes): `Audit Trail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `RBAC`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `Competitor Request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `Branding`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prefillInspectionAnswers()` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `isAnswerFilled()` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `normalizePayload()` connect `Community 9` to `Community 7`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `useAuth()` (e.g. with `ProtectedRoute()` and `AdminOrSecretaryRoute()`) actually correct?**
  _`useAuth()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `getAuthErrorMessage()` (e.g. with `handleEmailLogin()` and `handleGoogleLogin()`) actually correct?**
  _`getAuthErrorMessage()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Entry Form`, `Success Ballast`, `Audit Trail` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._