import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CharacterSheetPage } from './pages/CharacterSheetPage';
import { CharactersPage } from './pages/CharactersPage';
import { CreateCharacterWizardPage } from './pages/CreateCharacterWizardPage';
import { SessionsPage } from './pages/SessionsPage';
import { SessionViewPage } from './pages/SessionViewPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<CharactersPage />} />
          <Route path="/character/:id" element={<CharacterSheetPage />} />
          <Route path="/create" element={<CreateCharacterWizardPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/sessions/:id" element={<SessionViewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
