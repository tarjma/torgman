import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SubtitleConfigProvider } from './contexts/SubtitleConfigContext';

// Pages
import HomePageContainer from './pages/HomePage';
import ProjectEditorPage from './pages/ProjectEditor';

function App() {
  return (
    <SubtitleConfigProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePageContainer />} />
          <Route path="/:projectId" element={<ProjectEditorPage />} />
        </Routes>
      </Router>
    </SubtitleConfigProvider>
  );
}

export default App;