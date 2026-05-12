import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AuthRedirect } from './auth/AuthRedirect'
import { OnboardingRoute } from './auth/OnboardingRoute'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AdminOrSecretaryRoute } from './auth/RoleGate'
import {
  ArchiveRestore,
  ScrollText,
  Settings,
  Trophy,
  Wrench,
} from 'lucide-react'
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
import { SignUpPage } from './pages/SignUpPage'
import { TabPlaceholderPage } from './pages/TabPlaceholderPage'
import { TeamPage } from './pages/TeamPage'
import { TeamRequiredPage } from './pages/TeamRequiredPage'
import { UpdatePasswordPage } from './pages/UpdatePasswordPage'
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
        element: (
          <TabPlaceholderPage
            title="Race Result"
            description="Race results and championship standings routes are ready for the Race Result phase."
            icon={Trophy}
          />
        ),
      },
      {
        path: 'competitor-requests',
        element: <CompetitorRequestPage />,
      },
      {
        path: 'scrutineer-reports',
        element: (
          <AdminOrSecretaryRoute>
            <TabPlaceholderPage
              title="Scrutineer Report"
              description="Official scrutineer reports will be built for Admin and Secretary workflows in a later phase."
              icon={ScrollText}
            />
          </AdminOrSecretaryRoute>
        ),
      },
      {
        path: 'recently-delete',
        element: (
          <AdminOrSecretaryRoute>
            <TabPlaceholderPage
              title="Recently Delete"
              description="Soft-deleted form recovery will be implemented for Admin/Secretary operational controls."
              icon={ArchiveRestore}
            />
          </AdminOrSecretaryRoute>
        ),
      },
      {
        path: 'organizer-settings',
        element: (
          <AdminOrSecretaryRoute>
            <TabPlaceholderPage
              title="Organizer Settings"
              description="Season, event, race, series, and rule configuration will be implemented in the organizer settings phase."
              icon={Wrench}
            />
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
        path: 'settings/profile',
        element: (
          <TabPlaceholderPage
            title="Profile Settings"
            description="Profile editing route is ready. Profile forms will be implemented after shell navigation is approved."
            icon={Settings}
          />
        ),
      },
      {
        path: 'settings/privacy',
        element: (
          <TabPlaceholderPage
            title="Privacy Settings"
            description="Password and account security controls will be implemented in the settings phase."
            icon={Settings}
          />
        ),
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
