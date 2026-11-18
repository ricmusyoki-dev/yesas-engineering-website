import { RouterProvider } from 'react-router-dom'
import { appRouter } from './app/router'
import { AuthProvider } from './features/auth/AuthProvider'

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={appRouter} />
    </AuthProvider>
  )
}