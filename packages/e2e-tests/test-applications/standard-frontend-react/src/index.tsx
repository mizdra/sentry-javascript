import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import {
  Routes,
  BrowserRouter,
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
  Route,
} from 'react-router-dom';
import Index from './pages/Index';
import User from './pages/User';

const replay = new Sentry.Replay();

Sentry.init({
  dsn: process.env.REACT_APP_E2E_TEST_DSN,
  integrations: [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      ),
    }),
    replay,
  ],
  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,
  release: 'e2e-test',

  // Always capture replays, so we can test this properly
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 0.0,
});

Object.defineProperty(window, 'sentryReplayId', {
  get() {
    return replay['_replay'].session.id;
  },
});

Sentry.addGlobalEventProcessor(event => {
  if (
    event.type === 'transaction' &&
    (event.contexts?.trace?.op === 'pageload' || event.contexts?.trace?.op === 'navigation')
  ) {
    const eventId = event.event_id;
    if (eventId) {
      window.recordedTransactions = window.recordedTransactions || [];
      window.recordedTransactions.push(eventId);
    }
  }

  return event;
});

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <BrowserRouter>
    <SentryRoutes>
      <Route path="/" element={<Index />} />
      <Route path="/user/:id" element={<User />} />
    </SentryRoutes>
  </BrowserRouter>,
);
