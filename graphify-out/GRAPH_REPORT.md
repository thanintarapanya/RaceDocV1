# Graph Report - RaceDocV1Github  (2026-05-22)

## Corpus Check
- 46 files · ~62,151 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 332 nodes · 376 edges · 15 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.81)
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
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]

## God Nodes (most connected - your core abstractions)
1. `finishSave()` - 18 edges
2. `useAuth()` - 6 edges
3. `getAuthErrorMessage()` - 6 edges
4. `RacedocV1` - 5 edges
5. `refreshDetail()` - 4 edges
6. `prefillInspectionAnswers()` - 4 edges
7. `uploadEntryAsset()` - 4 edges
8. `uniqueValues()` - 4 edges
9. `uploadOrganizerAsset()` - 4 edges
10. `canSeeAdminNavigation()` - 3 edges

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
Cohesion: 0.12
Nodes (3): addReviewerDraft(), removeReviewerDraft(), updateReviewerDraft()

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (9): AuthRedirect(), OnboardingRoute(), ProtectedRoute(), AdminOrSecretaryRoute(), ScrutineerReportRoute(), useAuth(), canSeeAdminNavigation(), canSeeScrutineerReportNavigation() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (4): getInvitationNotice(), inviteRoleByEmail(), resendInvitation(), sendRoleInvitation()

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (6): calculateItemWeight(), createInspectionVersionDiff(), getSelectedValues(), getSingleSelectedValue(), isAnswerFilled(), mapReviews()

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (7): getAuthErrorMessage(), handleEmailLogin(), handleGoogleLogin(), handleSubmit(), validateIdentity(), handleSignUp(), handleSubmit()

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (3): normalizePrintOptions(), confirmPrintBackground(), loadPrintOptions()

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (8): Graphify, Balance of Performance (BOP), Entry Form, Inspection Form, RacedocV1, Success Ballast, Supabase, Weight-In

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (3): handleNotificationClick(), refreshNotifications(), getNotificationTargetPath()

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (1): Audit Trail

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): RBAC

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (1): Competitor Request

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (1): Branding

## Knowledge Gaps
- **8 isolated node(s):** `Entry Form`, `Success Ballast`, `Audit Trail`, `RBAC`, `Competitor Request` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 35`** (1 nodes): `Audit Trail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `RBAC`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `Competitor Request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `Branding`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prefillInspectionAnswers()` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `isAnswerFilled()` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `useAuth()` (e.g. with `ProtectedRoute()` and `AdminOrSecretaryRoute()`) actually correct?**
  _`useAuth()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `getAuthErrorMessage()` (e.g. with `handleEmailLogin()` and `handleGoogleLogin()`) actually correct?**
  _`getAuthErrorMessage()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Entry Form`, `Success Ballast`, `Audit Trail` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._