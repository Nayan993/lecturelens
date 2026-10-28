import { configure } from '@testing-library/react';

// The page tests render the whole app (router, providers, lazy chunks, mock adapters). When all test
// files run in parallel jsdom workers, a cold lazy import can exceed Testing Library's 1 s default
// for findBy* / waitFor, so integration tests get one shared, more generous limit.
configure({ asyncUtilTimeout: 5000 });
