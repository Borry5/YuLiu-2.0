import { useEffect } from 'react';
import { MainLayout } from "./components/layout/MainLayout";
import { useAppStore } from './store/useAppStore';
import { SettingsModal } from './components/chat/SettingsModal';

function App() {
  const { theme, isSettingsOpen } = useAppStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Handle system preference on first load if not set? 
  // persist store defaults to 'light'. 
  // Ideally check system pref, but 'light' default is fine for MVP.

  return (
    <>
      <MainLayout />
      {isSettingsOpen && <SettingsModal />}
    </>
  );
}

export default App;
