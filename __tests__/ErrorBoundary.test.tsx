import { renderRouter } from 'expo-router/testing-library';

import * as RootLayout from '../app/_layout';

// Renders through Expo Router's own error-boundary wiring (the
// `ErrorBoundary` export from app/_layout.tsx), not the component in
// isolation -- so this also verifies the export is actually wired up.
function ThrowingScreen(): never {
  throw new Error('boom');
}

it('a route that throws is replaced by the error screen', async () => {
  // React (and the boundary itself, deliberately) both log the thrown
  // error to the console -- expected noise for this test, not a failure.
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

  const { findByText } = await renderRouter(
    {
      _layout: RootLayout,
      index: ThrowingScreen,
      settings: () => null, // _layout.tsx declares this screen; stubbed so the router doesn't warn about a missing route
    },
    { initialUrl: '/' }
  );

  expect(await findByText('Something went wrong.')).toBeTruthy();
  consoleError.mockRestore();
});
