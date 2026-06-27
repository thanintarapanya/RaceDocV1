# Graph Report - RaceDocV1Github  (2026-06-27)

## Corpus Check
- 65 files · ~82,234 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 466 nodes · 538 edges · 22 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]

## God Nodes (most connected - your core abstractions)
1. `finishSave()` - 20 edges
2. `useAuth()` - 7 edges
3. `getAuthErrorMessage()` - 7 edges
4. `createOrganizerSetupBoard()` - 5 edges
5. `stageManualRow()` - 5 edges
6. `RacedocV1` - 5 edges
7. `refreshDetail()` - 4 edges
8. `prefillInspectionAnswers()` - 4 edges
9. `stageCsvFile()` - 4 edges
10. `uploadEntryAsset()` - 4 edges

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
Nodes (55): createBallastRuleForm(), createCircuitForm(), createEmptyBallastRuleForm(), createEmptyCircuitForm(), createEmptyEventForm(), createEmptyEventSeriesRuleForm(), createEmptyGradeForm(), createEmptyInspectionItemForm() (+47 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (23): createBatch(), createInitialEntryFormState(), createPersonalSnapshot(), draw(), getCanvasPoint(), handleDocumentUpload(), handleSignatureUpload(), handleSubmitBatch() (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (14): createInspectionFilePath(), createInspectionForm(), flattenSnapshot(), normalizeLabel(), openInspectionForm(), prefillInspectionAnswers(), refreshDetail(), refreshEntries() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (9): createOrganizerSetupBoard(), createSetupStep(), getClassActionLabel(), getClassEditorKey(), getEligibleGradesForEventSeries(), getEligibleSeriesForEvent(), getRuleEditorKey(), createEventSeriesRuleDraft() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (9): clean(), loadInitialProfile(), saveProfile(), loadInitialData(), getInvitationNotice(), inviteRoleByEmail(), normalizePayload(), resendInvitation() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (12): downloadCsvTemplate(), loadMatches(), createPaperEntryCsvTemplate(), firstNonEmpty(), getPaperEntryImportRowSummary(), getPaperEntryMatchPayload(), getPayloadRecord(), normalizeHeader() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (3): addReviewerDraft(), removeReviewerDraft(), updateReviewerDraft()

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (11): AuthRedirect(), OnboardingRoute(), ProtectedRoute(), AdminOnlyRoute(), AdminOrSecretaryRoute(), ScrutineerReportRoute(), useAuth(), canSeeAdminNavigation() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (8): getAuthErrorMessage(), handleEmailLogin(), handleGoogleLogin(), handleSubmit(), validateIdentity(), updatePassword(), handleSignUp(), handleSubmit()

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (4): parseNullableInteger(), printSelectedResult(), saveEntry(), canPrintRaceResult()

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (6): calculateItemWeight(), createInspectionVersionDiff(), getSelectedValues(), getSingleSelectedValue(), isAnswerFilled(), mapReviews()

### Community 11 - "Community 11"
Cohesion: 0.2
Nodes (8): buildAuditTrailCsv(), normalizeAuditTrailPayload(), applyFilters(), exportVisibleRows(), fetchAuditTrail(), loadAuditTrail(), movePage(), run()

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (3): handleTeamInfoSubmit(), createTeamInfoPayload(), nullableTeamText()

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (5): getPrintBackgroundAsset(), getPrintBackgroundOptionsForOrientation(), normalizePrintOptions(), confirmPrintBackground(), loadPrintOptions()

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (2): getEntryListFilterOptions(), uniqueSorted()

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (8): Graphify, Balance of Performance (BOP), Entry Form, Inspection Form, RacedocV1, Success Ballast, Supabase, Weight-In

### Community 18 - "Community 18"
Cohesion: 0.38
Nodes (4): createCard(), createDashboardCards(), getFallbackScope(), normalizeDashboardSummary()

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (3): handleNotificationClick(), refreshNotifications(), getNotificationTargetPath()

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (1): Audit Trail

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (1): RBAC

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (1): Competitor Request

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (1): Branding

## Knowledge Gaps
- **8 isolated node(s):** `Entry Form`, `Success Ballast`, `Audit Trail`, `RBAC`, `Competitor Request` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 16`** (8 nodes): `createEmptyEntryListFilters()`, `filterEntryList()`, `getEntryListFilterOptions()`, `getEntryStatusDisplay()`, `getPaperEntryReadiness()`, `hasActiveEntryListFilters()`, `uniqueSorted()`, `entryFormListHelpers.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `Audit Trail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `RBAC`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `Competitor Request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `Branding`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createEventSeriesRuleDraft()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `normalizeEventSeriesRuleForm()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `useAuth()` (e.g. with `ProtectedRoute()` and `AdminOrSecretaryRoute()`) actually correct?**
  _`useAuth()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `getAuthErrorMessage()` (e.g. with `handleEmailLogin()` and `handleGoogleLogin()`) actually correct?**
  _`getAuthErrorMessage()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `stageManualRow()` (e.g. with `createPaperEntryImportPayload()` and `createEmptyPaperEntryDraft()`) actually correct?**
  _`stageManualRow()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Entry Form`, `Success Ballast`, `Audit Trail` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._