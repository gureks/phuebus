import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Display from './components/Display';
import Remote from './components/Remote';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/display" element={<Display />} />
      <Route path="/remote" element={<Remote />} />
    </Routes>
  );
}

export default App;
