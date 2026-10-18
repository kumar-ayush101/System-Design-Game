# System Design Academy — learn system design by playing

![type](https://img.shields.io/badge/pure-HTML%2FCSS%2FJS-f7df1e)
![deps](https://img.shields.io/badge/dependencies-none-success)
![build](https://img.shields.io/badge/build%20step-none-6ea8fe)
![concepts](https://img.shields.io/badge/concepts-37-8b7bff)
![areas](https://img.shields.io/badge/areas-6-39d0d8)

An interactive course that teaches the hardest **system design** concepts the way
they actually stick: first **explained in plain language**, then drawn as an
**architecture diagram**, and finally turned into an **interactive simulation you
play with**. Every concept has all three.

**Pure HTML + CSS + JavaScript + Canvas. No frameworks, no libraries, no build
step, no accounts.** Open `index.html` and start learning.

## Run it

Open `index.html` in any modern browser. That's it.

> To serve from a local server instead (identical behaviour), use any static
> server, e.g. `python -m http.server` and open the printed URL.

## How a concept works

Each concept page has three tabs:

1. **📖 Learn** — a clear, first-principles explanation: what it is, why it
   exists, what problem it solves, and where the trade-off lives.
2. **🗺️ Diagram** — a clean architecture diagram of how the pieces fit together.
3. **🎮 Play** — a hands-on simulation. You *do* something — route traffic, trip
   a circuit breaker, cause a network partition, kill a database primary, pack
   containers onto a host — and watch the concept behave.

Your progress is saved locally (in the browser) with a completion ring at the top.

## The curriculum — 6 areas, 37 concepts

### Area 1 · Scalability & Reliability
Load Balancing · Caching · Replication · Sharding · Rate Limiting · Fault Tolerance

### Area 2 · Network & Communication
HTTP / HTTPS · REST · gRPC · WebSockets · Message Queues · Event-Driven Systems

### Area 3 · Data & Distributed Systems
SQL / NoSQL · Indexing · Transactions & ACID · Database Replication & Failover ·
Consistent Hashing · Consistency & CAP

### Area 4 · Security & Observability
Authentication · Authorization · Sessions & Tokens · RBAC · Logging · Metrics ·
Distributed Tracing

### Area 5 · Architecture & API Design
Monolith · Microservices · Modular Monolith · API Gateway · Service Discovery ·
Loose Coupling

### Area 6 · Infrastructure & Deployment
CI/CD · Infrastructure as Code · Docker & Containers · Kubernetes · Serverless ·
Disaster Recovery

## A taste of the simulations

- **Load Balancing** — be the load balancer: pick round-robin / least-connections
  / random / sticky, crank up traffic, and kill servers to watch each strategy
  cope.
- **Caching** — tune cache size and eviction policy (LRU/LFU/FIFO) against
  realistic skewed traffic and chase a higher hit rate.
- **Rate Limiting** — drain a token bucket with bursts and feel the
  burst-vs-sustained trade-off (200s vs 429s).
- **Circuit Breaker (Fault Tolerance)** — break a dependency and watch the breaker
  trip OPEN, then probe and recover via HALF-OPEN.
- **Consistency & CAP** — partition the network, pick CP or AP, write on one side
  and read from the other to feel strong vs eventual consistency.
- **Consistent Hashing** — add/remove nodes on a hash ring and compare the keys
  moved vs naive `hash % N`.
- **Transactions** — crash a money transfer mid-way and see atomic rollback save
  you (or watch money vanish without a transaction).
- **Kubernetes** — set desired replicas, kill pods, spike traffic, and watch
  self-healing and autoscaling reconcile the cluster.
- **Serverless** — watch instances cold-start on demand, scale with load, and
  scale to zero (idle cost `$0`).

…and 28 more.

## Project structure

```text
.
├── index.html              # entry point; loads engine, diagram, 37 concepts, app
├── styles.css              # dark, glassy, animated UI
└── js/
    ├── engine.js           # tiny canvas framework: Sim loop, Packet, draw helpers,
    │                       #   game-shell + stat/button/tool/toast builders
    ├── diagram.js          # declarative SVG architecture-diagram builder
    ├── registry.js         # the 6 areas and their ordered concept lists
    ├── app.js              # hash router, UI shell, tabs, localStorage progress
    └── concepts/           # one self-contained module per concept
        ├── loadBalancing.js
        ├── caching.js
        └── … (37 total)
```

Each concept module self-registers via:

```js
SDE.register({
  id, title, tagline, diagramNote, gameNote,
  explanation,      // HTML string (the Learn tab)
  diagram(),        // returns an SVG string (the Diagram tab)
  game(root),       // mounts the interactive sim, returns it for cleanup
});
```

The registry maps those ids into areas, and the app routes between them.

## Verification

A headless integration test (`_test.js` during development) stubbed the DOM,
canvas, and `localStorage`, loaded every script in `index.html` order, and
asserted that all 6 areas and 37 concepts are wired, every concept has a
substantial explanation plus a diagram and a game, all 37 diagrams render valid
SVG, and all 37 games mount and run several simulation frames without runtime
errors. All checks passed.

## License

MIT.
