/* ============================================================
   registry.js — defines the 6 areas and their ordered concepts.
   Concept content/diagram/game live in js/concepts/*.js and
   self-register via SDE.register({ id, ... }). This file wires
   ids into areas and provides lookup helpers.
   ============================================================ */
(function (global) {
  "use strict";
  const SDE = global.SDE;

  SDE.AREAS = [
    {
      id: "area1",
      num: 1,
      title: "Scalability & Reliability",
      desc: "How systems grow to handle more traffic and keep running when parts fail.",
      icon: "📈",
      grad: "linear-gradient(135deg,#6ea8fe,#8b7bff)",
      concepts: ["load-balancing", "caching", "replication", "sharding", "rate-limiting", "fault-tolerance"],
    },
    {
      id: "area2",
      num: 2,
      title: "Network & Communication",
      desc: "The protocols and patterns services use to talk to each other.",
      icon: "🔗",
      grad: "linear-gradient(135deg,#39d0d8,#6ea8fe)",
      concepts: ["http-https", "rest", "grpc", "websockets", "message-queues", "event-driven"],
    },
    {
      id: "area3",
      num: 3,
      title: "Data & Distributed Systems",
      desc: "Storing data and keeping it correct across many machines.",
      icon: "🗄️",
      grad: "linear-gradient(135deg,#8b7bff,#ff7bc2)",
      concepts: ["sql-nosql", "indexing", "transactions", "data-replication", "data-sharding", "consistency"],
    },
    {
      id: "area4",
      num: 4,
      title: "Security & Observability",
      desc: "Proving who users are, what they can do, and seeing inside your system.",
      icon: "🛡️",
      grad: "linear-gradient(135deg,#3ddc84,#39d0d8)",
      concepts: ["authentication", "authorization", "sessions", "rbac", "logging", "metrics", "tracing"],
    },
    {
      id: "area5",
      num: 5,
      title: "Architecture & API Design",
      desc: "How to structure a system into services and the seams between them.",
      icon: "🏛️",
      grad: "linear-gradient(135deg,#ffca3a,#ff7bc2)",
      concepts: ["monolith", "microservices", "modular-monolith", "api-gateway", "service-discovery", "loose-coupling"],
    },
    {
      id: "area6",
      num: 6,
      title: "Infrastructure & Deployment",
      desc: "Shipping, running, and recovering systems in production.",
      icon: "🚀",
      grad: "linear-gradient(135deg,#ff7bc2,#8b7bff)",
      concepts: ["cicd", "iac", "docker", "kubernetes", "serverless", "disaster-recovery"],
    },
  ];

  // Flat ordered list of concept ids (for prev/next navigation).
  SDE.ORDER = SDE.AREAS.flatMap((a) => a.concepts);

  SDE.getConcept = function (id) { return SDE._concepts[id]; };
  SDE.getArea = function (id) { return SDE.AREAS.find((a) => a.id === id); };
  SDE.areaOf = function (conceptId) { return SDE.AREAS.find((a) => a.concepts.includes(conceptId)); };

  SDE.totalConcepts = function () { return SDE.ORDER.length; };
})(window);
