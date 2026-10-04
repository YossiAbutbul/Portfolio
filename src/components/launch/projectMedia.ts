/* Shared by the project presentations. */

export const PREVIEWS: Record<string, string> = {
  "test-console": "/projects/test-console/screenshot.png",
  oplanner: "/projects/oplanner/poster.jpg",
  "pipeline-cpu": "/projects/pipeline-cpu/poster.jpg",
  "current-logger": "/projects/current-logger/screenshot.png",
  algorithmx: "/projects/algorithmx/screenshot.png",
  "cpp-hero": "/projects/cpp-hero/screenshot.png",
  "toast-turn": "/projects/toast-turn/cover.png",
};

/* Silent loops of the apps working, each with a poster from its own first frames and its true size.
   Test Console, OPlanner and Pipeline CPU are screen recordings of the real apps (Test Console's is a
   VP8 WebM); AlgorithmX, Cpp Hero and ToastTurn were recorded from the live sites. Current Logger
   needs its lab hardware, so it shows a still screenshot. */
export const DEMOS: Record<string, { src: string; poster: string; w: number; h: number }> = {
  "test-console": { src: "/projects/test-console/demo.webm", poster: "/projects/test-console/demo-poster.jpg", w: 1440, h: 900 },
  oplanner: { src: "/projects/oplanner/demo.mp4", poster: "/projects/oplanner/demo-poster.jpg", w: 1920, h: 1112 },
  "pipeline-cpu": { src: "/projects/pipeline-cpu/demo.mp4", poster: "/projects/pipeline-cpu/demo-poster.jpg", w: 1920, h: 1080 },
  algorithmx: { src: "/projects/algorithmx/demo.mp4", poster: "/projects/algorithmx/demo-poster.jpg", w: 1920, h: 1080 },
  "cpp-hero": { src: "/projects/cpp-hero/demo.mp4", poster: "/projects/cpp-hero/demo-poster.jpg", w: 1920, h: 1080 },
  "toast-turn": { src: "/projects/toast-turn/demo.mp4", poster: "/projects/toast-turn/demo-poster.jpg", w: 1920, h: 1080 },
};
