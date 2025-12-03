import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import HomePageContainer from './pages/HomePage';
import ProjectEditorPage from './pages/ProjectEditor';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePageContainer />} />
        <Route path="/:projectId" element={<ProjectEditorPage />} />
      </Routes>
    </Router>
  );
}

export default App;