# Graph Report - RaceDocV1Github  (2026-05-13)

## Corpus Check
- 34 files · ~37,183 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 145 nodes · 138 edges · 12 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 7 edges
2. `getAuthErrorMessage()` - 6 edges
3. `RacedocV1` - 5 edges
4. `canSeeAdminNavigation()` - 4 edges
5. `uploadEntryAsset()` - 4 edges
6. `uniqueValues()` - 4 edges
7. `getNavigationItems()` - 3 edges
8. `AdminOrSecretaryRoute()` - 3 edges
9. `loadOptions()` - 3 edges
10. `updateStep1()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `RacedocV1` --indexes--> `Graphify`  [INFERRED]
  RaceDocV1_Architecture.md → AGENTS.md
- `canSeeAdminNavigation()` --calls--> `AdminOrSecretaryRoute()`  [INFERRED]
  src/navigation.tsx → src/auth/RoleGate.tsx
- `ProtectedRoute()` --calls--> `useAuth()`  [INFERRED]
  src/auth/ProtectedRoute.tsx → src/auth/useAuth.ts
- `ScrutineerReportRoute()` --calls--> `useAuth()`  [INFERRED]
  src/auth/RoleGate.tsx → src/auth/useAuth.ts
- `useAuth()` --calls--> `OnboardingRoute()`  [INFERRED]
  src/auth/useAuth.ts → src/auth/OnboardingRoute.tsx

## Communities

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (7): getAuthErrorMessage(), handleEmailLogin(), handleGoogleLogin(), handleSubmit(), validateIdentity(), handleSignUp(), handleSubmit()

### Community 2 - "Community 2"
Cohesion: 0.2
Nodes (6): AuthRedirect(), OnboardingRoute(), ProtectedRoute(), AdminOrSecretaryRoute(), ScrutineerReportRoute(), useAuth()

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (4): CompetitorRequestPage(), canSeeAdminNavigation(), canSeeScrutineerReportNavigation(), getNavigationItems()

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (8): Graphify, Balance of Performance (BOP), Entry Form, Inspection Form, RacedocV1, Success Ballast, Supabase, Weight-In

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): handleDocumentUpload(), handleSignatureUpload(), sanitizeFileName(), updateConsent(), updateDocumentAsset(), uploadEntryAsset()

### Community 9 - "Community 9"
Cohesion: 0.5
Nodes (5): loadOptions(), uniqueValues(), updateSeason(), updateSeries(), updateStep1()

### Community 14 - "Community 14"
Cohesion: 0.67
Nodes (3): createInitialEntryFormState(), createPersonalSnapshot(), handleSubmitBatch()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (3): draw(), getCanvasPoint(), startDrawing()

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (1): Audit Trail

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (1): RBAC

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (1): Competitor Request

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (1): Branding

## Knowledge Gaps
- **8 isolated node(s):** `Entry Form`, `Success Ballast`, `Audit Trail`, `RBAC`, `Competitor Request` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 29`** (1 nodes): `Audit Trail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `RBAC`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `Competitor Request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `Branding`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 2` to `Community 3`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `CompetitorRequestPage()` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `canSeeAdminNavigation()` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `useAuth()` (e.g. with `ProtectedRoute()` and `AdminOrSecretaryRoute()`) actually correct?**
  _`useAuth()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `getAuthErrorMessage()` (e.g. with `handleEmailLogin()` and `handleGoogleLogin()`) actually correct?**
  _`getAuthErrorMessage()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `canSeeAdminNavigation()` (e.g. with `AdminOrSecretaryRoute()` and `CompetitorRequestPage()`) actually correct?**
  _`canSeeAdminNavigation()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Entry Form`, `Success Ballast`, `Audit Trail` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._