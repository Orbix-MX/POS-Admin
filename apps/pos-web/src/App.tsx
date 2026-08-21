import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '~/app/providers/AppProviders'
import { AppRouter } from '~/app/router/AppRouter'
import { ToastHost } from '~/components/ui/Toast'

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
        <ToastHost />
      </AppProviders>
    </BrowserRouter>
  )
}
