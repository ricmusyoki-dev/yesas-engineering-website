import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { DashboardLayout } from '../features/dashboard/DashboardLayout'
import {
  DashboardModulePage,
  DashboardOverview,
  NotAuthorizedPage,
} from '../features/dashboard/DashboardPages'
import {
  AuthenticatedRoute,
  LoginRoute,
  ManagementRoleRoute,
} from '../features/auth/ProtectedRoutes'
import { LoginPage } from '../features/auth/LoginPage'
import { PublicLayout } from '../layouts/PublicLayout'
import { AboutPage } from '../pages/AboutPage'
import { ContactPage } from '../pages/ContactPage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PrivacyPolicyPage } from '../pages/PrivacyPolicyPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { ServiceDetailPage } from '../pages/ServiceDetailPage'
import { ServicesPage } from '../pages/ServicesPage'

export const appRoutes: RouteObject[] = [
  {
    path: '/dashboard/login',
    element: <LoginRoute />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/dashboard',
    element: <AuthenticatedRoute />,
    children: [
      { path: 'not-authorized', element: <NotAuthorizedPage /> },
      {
        element: <ManagementRoleRoute />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              { index: true, element: <DashboardOverview /> },
              {
                path: 'company',
                element: <DashboardModulePage title="Company Profile" />,
              },
              {
                path: 'homepage',
                element: <DashboardModulePage title="Homepage" />,
              },
              {
                path: 'services',
                element: <DashboardModulePage title="Services" />,
              },
              {
                path: 'projects',
                element: <DashboardModulePage title="Projects" />,
              },
              {
                path: 'media',
                element: <DashboardModulePage title="Media Library" />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'services/:slug', element: <ServiceDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:slug', element: <ProjectDetailPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'privacy-policy', element: <PrivacyPolicyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const appRouter = createBrowserRouter(appRoutes)
