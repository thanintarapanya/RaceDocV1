# Graph Report - RaceDocV1Github  (2026-05-13)

## Corpus Check
- 33 files · ~34,690 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 138 nodes · 130 edges · 11 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 6 edges
2. `getAuthErrorMessage()` - 6 edges
3. `RacedocV1` - 5 edges
4. `canSeeAdminNavigation()` - 4 edges
5. `uploadEntryAsset()` - 4 edges
6. `uniqueValues()` - 4 edges
7. `AdminOrSecretaryRoute()` - 3 edges
8. `loadOptions()` - 3 edges
9. `updateStep1()` - 3 edges
10. `handleDocumentUpload()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `RacedocV1` --indexes--> `Graphify`  [INFERRED]
  RaceDocV1_Architecture.md → AGENTS.md
- `ProtectedRoute()` --calls--> `useAuth()`  [INFERRED]
  src/auth/ProtectedRoute.tsx → src/auth/useAuth.ts
- `useAuth()` --calls--> `OnboardingRoute()`  [INFERRED]
  src/auth/useAuth.ts → src/auth/OnboardingRoute.tsx
- `useAuth()` --calls--> `AuthRedirect()`  [INFERRED]
  src/auth/useAuth.ts → src/auth/AuthRedirect.tsx
- `getAuthErrorMessage()` --calls--> `handleEmailLogin()`  [INFERRED]
  src/lib/auth-errors.ts → src/pages/LoginPage.tsx

## Communities

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (8): AuthRedirect(), OnboardingRoute(), ProtectedRoute(), AdminOrSecretaryRoute(), useAuth(), CompetitorRequestPage(), canSeeAdminNavigation(), getNavigationItems()

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (7): getAuthErrorMessage(), handleEmailLogin(), handleGoogleLogin(), handleSubmit(), validateIdentity(), handleSignUp(), handleSubmit()

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (8): Graphify, Balance of Performance (BOP), Entry Form, Inspection Form, RacedocV1, Success Ballast, Supabase, Weight-In

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (6): handleDocumentUpload(), handleSignatureUpload(), sanitizeFileName(), updateConsent(), updateDocumentAsset(), uploadEntryAsset()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (5): loadOptions(), uniqueValues(), updateSeason(), updateSeries(), updateStep1()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (3): createInitialEntryFormState(), createPersonalSnapshot(), handleSubmitBatch()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (3): draw(), getCanvasPoint(), startDrawing()

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (1): Audit Trail

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (1): RBAC

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (1): Competitor Request

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (1): Branding

## Knowledge Gaps
- **8 isolated node(s):** `Entry Form`, `Success Ballast`, `Audit Trail`, `RBAC`, `Competitor Request` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 27`** (1 nodes): `Audit Trail`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `RBAC`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `Competitor Request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `Branding`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 5 inferred relationships involving `useAuth()` (e.g. with `ProtectedRoute()` and `AdminOrSecretaryRoute()`) actually correct?**
  _`useAuth()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `getAuthErrorMessage()` (e.g. with `handleEmailLogin()` and `handleGoogleLogin()`) actually correct?**
  _`getAuthErrorMessage()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `canSeeAdminNavigation()` (e.g. with `AdminOrSecretaryRoute()` and `CompetitorRequestPage()`) actually correct?**
  _`canSeeAdminNavigation()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Entry Form`, `Success Ballast`, `Audit Trail` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._