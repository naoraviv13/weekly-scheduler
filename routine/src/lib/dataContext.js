import { createContext, useContext } from 'react';

/** Shared store context. Split from the provider so the hook and the
 *  component can live in separate modules (keeps fast refresh happy). */
export const DataContext = createContext(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
