import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import ToolPage from './pages/ToolPage';
import Semester from './pages/Semester';
import SourceCode from './pages/SourceCode';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/tools/:id" element={<ToolPage />} />
          <Route path="/semester" element={<Semester />} />
          <Route path="/source" element={<SourceCode />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
