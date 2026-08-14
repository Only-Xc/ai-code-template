import { AppProvider } from './components/AppProvider'
import { AppRouter } from './router'

function App() {
  return (
    <AppProvider>
      <AppRouter></AppRouter>
    </AppProvider>
  )
}

export default App
