# Real-Time Monitoring System

## Overview
WebSocket-based real-time monitoring with SSE fallback. Provides live event streaming and metrics tracking for the dashboard.

## Components
- `event-bus.js`: In-memory pub/sub event bus with history (max 500 events)
- `metrics-store.js`: Simple key-value metrics store with increment/snapshot
- `monitoring-sanitizer.js`: Health payload builder and event emitter
- `websocket-server.js`: WebSocket server at `/ws` with auth and topic subscriptions
- `monitoring-routes.js`: Dashboard API routes for monitoring data

## WebSocket Protocol
- **Connect**: `ws://host/ws` with `x-dashboard-token` header
- **Subscribe**: `{"type":"subscribe","topics":["health","cicd"]}`
- **Unsubscribe**: `{"type":"unsubscribe","topics":["health"]}`
- **Ping/Pong**: `{"type":"ping"}` responds with `{"type":"pong"}`
- **Events**: Server pushes events as JSON with topic, severity, title, summary
