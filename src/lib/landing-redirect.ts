// Shared between __root.tsx and routes/index.tsx: once the root layout has
// mounted, any navigation to "/" is an in-app navigation (e.g. the "Landed"
// back button) and should show the home page, not run the entry redirect.
export const landingState = { appMounted: false };
