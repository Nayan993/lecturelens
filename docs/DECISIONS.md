# LectureLens — Decision Log

Append-only. **Newest first** — add new rows at the top of the table. Never edit or delete
an existing row; to reverse a decision, add a new row that supersedes it and names the old one.
Contract-affecting decisions must also be reflected in [`CONTRACTS.md`](./CONTRACTS.md).

| Date | Decision | Made by | Why |
| --- | --- | --- | --- |
| 2026-10-28 | Two seeded demo accounts (teacher@lecturelens.dev, student@lecturelens.dev, password "lecturelens") are part of the contract (CONTRACTS.md §9); the mock adapter and the server seed use exactly these, and the seed never runs in production. | Member D | The login page offers one-click demo sign-in for the viva; a single documented source stops the client mock and the server seed drifting apart. |
| 2026-10-27 | Every route listed in `CONTRACTS.md` is mounted from day one; until its owner implements it, it returns `501 NOT_IMPLEMENTED` with `details: { owner, prompt }`. Fabricated success data from server routes is forbidden. | Member D | Four people build in parallel; a stable route map lets the client integrate early, and a loud 501 can't be mistaken for a working feature the way fake `200` data can. |
| 2026-10-27 | All media offsets are float seconds rounded to 3 decimals, named `startSec` / `endSec`; `hh:mm:ss` strings and integer milliseconds are forbidden for media positions. | Member D | The HTML5 player seeks with `video.currentTime = 612.34`, ASR returns seconds, and one unit end-to-end removes a whole class of conversion bugs between transcript, chunks, topics, citations and deep links. |
| 2026-10-27 | Two-process architecture: one React/Vite client and one Express API server. The media pipeline (FFmpeg, transcription, chunking, embeddings, LLM calls) runs in-process inside the API with status persisted on the lecture document — no Python service, worker process, job queue, Redis or separate vector database. | Member D | Smallest system a four-person team can run, debug and deploy; MongoDB Atlas already holds the data and its indexes, and lecture volume does not justify extra infrastructure. |
