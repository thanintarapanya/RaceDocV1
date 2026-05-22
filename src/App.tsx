import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AuthRedirect } from './auth/AuthRedirect'
import { OnboardingRoute } from './auth/OnboardingRoute'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AdminOnlyRoute, AdminOrSecretaryRoute, ScrutineerReportRoute } from './auth/RoleGate'
import { AppLayout } from './layout/AppLayout'
import { AuthHealthPage } from './pages/AuthHealthPage'
import { ChecklistPage } from './pages/ChecklistPage'
import { CompetitorRequestPage } from './pages/CompetitorRequestPage'
import { DashboardPage } from './pages/DashboardPage'
import { EntryFormPage } from './pages/EntryFormPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { InspectionFormPage } from './pages/InspectionFormPage'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { OrganizerSettingsPage } from './pages/OrganizerSettingsPage'
import { ProfileSettingsPage } from './pages/ProfileSettingsPage'
import { PrivacySettingsPage } from './pages/PrivacySettingsPage'
import { RaceResultPage } from './pages/RaceResultPage'
import { RecentlyDeletedPage } from './pages/RecentlyDeletedPage'
import { SignUpPage } from './pages/SignUpPage'
import { ScrutineerReportPage } from './pages/ScrutineerReportPage'
import { TeamPage } from './pages/TeamPage'
import { TeamRequiredPage } from './pages/TeamRequiredPage'
import { UpdatePasswordPage } from './pages/UpdatePasswordPage'
import { UserRolePage } from './pages/UserRolePage'
import { WeightInPage } from './pages/WeightInPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthRedirect />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignUpPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <UpdatePasswordPage />,
  },
  {
    path: '/onboarding',
    element: (
      <OnboardingRoute>
        <OnboardingPage />
      </OnboardingRoute>
    ),
  },
  {
    path: '/onboarding/team',
    element: (
      <OnboardingRoute>
        <TeamRequiredPage />
      </OnboardingRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'team',
        element: <TeamPage />,
      },
      {
        path: 'entry-forms',
        element: <EntryFormPage />,
      },
      {
        path: 'checklist',
        element: <ChecklistPage />,
      },
      {
        path: 'inspection-forms',
        element: <InspectionFormPage />,
      },
      {
        path: 'weight-in',
        element: <WeightInPage />,
      },
      {
        path: 'race-results',
        element: <RaceResultPage />,
      },
      {
        path: 'competitor-requests',
        element: <CompetitorRequestPage />,
      },
      {
        path: 'scrutineer-reports',
        element: (
          <ScrutineerReportRoute>
            <ScrutineerReportPage />
          </ScrutineerReportRoute>
        ),
      },
      {
        path: 'recently-delete',
        element: (
          <AdminOnlyRoute>
            <RecentlyDeletedPage />
          </AdminOnlyRoute>
        ),
      },
      {
        path: 'organizer-settings',
        element: (
          <AdminOrSecretaryRoute>
            <OrganizerSettingsPage />
          </AdminOrSecretaryRoute>
        ),
      },
      {
        path: 'auth-health',
        element: (
          <AdminOrSecretaryRoute>
            <AuthHealthPage />
          </AdminOrSecretaryRoute>
        ),
      },
      {
        path: 'settings/user-roles',
        element: (
          <AdminOrSecretaryRoute>
            <UserRolePage />
          </AdminOrSecretaryRoute>
        ),
      },
      {
        path: 'settings/profile',
        element: <ProfileSettingsPage />,
      },
      {
        path: 'settings/privacy',
        element: <PrivacySettingsPage />,
      },
    ],
  },
])

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
