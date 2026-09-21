import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import Auth from './Auth.jsx';
import { DataProvider } from './DataContext.jsx';
import { supabase } from './supabaseClient';
import { Spinner } from './components/ui.jsx';

import HomeRoute from './routes/Home.jsx';
import RoutinesRoute from './routes/Routines.jsx';
import RoutineEditorRoute from './routes/RoutineEditor.jsx';
import ActiveWorkoutRoute from './routes/ActiveWorkout.jsx';
import ExercisesRoute from './routes/Exercises.jsx';
import ExerciseDetailRoute from './routes/ExerciseDetail.jsx';
import ProgressRoute from './routes/Progress.jsx';
import ProfileRoute from './routes/Profile.jsx';
import WorkoutDetailRoute from './routes/WorkoutDetail.jsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'routines', element: <RoutinesRoute /> },
      { path: 'routines/:id', element: <RoutineEditorRoute /> },
      { path: 'workout', element: <ActiveWorkoutRoute /> },
      { path: 'workout/:id', element: <WorkoutDetailRoute /> },
      { path: 'exercises', element: <ExercisesRoute /> },
      { path: 'exercises/:id', element: <ExerciseDetailRoute /> },
      { path: 'progress', element: <ProgressRoute /> },
      { path: 'profile', element: <ProfileRoute /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

function Root() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <Spinner label="Starting Ironlog" />;
  if (!session) return <Auth />;

  return (
    <DataProvider userId={session.user.id}>
      <RouterProvider router={router} />
    </DataProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
