# LectureLens — known limitations (as of 2026-11-01, branch `d/final-integration`)

What works, what is partial, and what does not exist yet. Every number here comes from a
script in `evaluation/` or an end-to-end run; nothing is estimated.

**Models are pretrained and used as is:**
- **ASR:** AssemblyAI Universal-2 / Groq Whisper large-v3-turbo.
- **Embeddings:** Xenova/all-MiniLM-L6-v2.
- **LLM:** a hosted OpenAI-compatible model, `openai/gpt-oss-120b` on Groq.

We did not train or fine-tune any of them. Topic segmentation is an **unsupervised heuristic**,
not a trained model.

## Implemented (real API, used by the client)

| Area | Routes | Owner |
| --- | --- | --- |
| Auth, lectures, upload, status, reprocess, delete, signed media | `/auth/*`, `/lectures*` | D |
| Media + ASR pipeline (FFmpeg, lossless MP4 remux, AssemblyAI → Groq fallback, retries) | pipeline stages `extracting`, `transcribing` | A |
| Transcript read / edit / approve | `/lectures/:id/transcript`, `/segments/:index`, `/transcript/approve` | A |
| Chunking, fixed-window topics, LLM/TF-IDF labels, topic edit/approve | `/lectures/:id/topics`, `PATCH /topics/:id`, `/topics/:id/approve` | B |
| Summaries with evidence + faithfulness check, approve | `/lectures/:id/summaries`, `/summaries/:id/approve` | B |
| Embeddings + `indexing` stage, keyword/vector/hybrid retrieval | pipeline stage `indexing`, `POST /search` | C |
| Grounded Q&A with citation validation and two abstention triggers | `POST /ask` | C |
| MCQ generation, review queue, approve/reject/edit | `/lectures/:id/questions/generate`, `GET /questions`, `PATCH /questions/:id` | C |
| Quizzes, attempts, revision plan | `/quizzes*`, `/attempts/:id`, `/revision-plan` | C |

## Still `501 NOT_IMPLEMENTED` (honest stubs; the client shows "not available yet")

- **`POST /topics/:id/reject`** (B, PB.1). Teachers can edit or approve topics, but not reject them.
- **`PATCH /summaries/:id`** and **`POST /summaries/:id/reject`** (B, PB.2).
  - Summaries can only be approved.
  - Checked in the browser: rejecting one shows "Summary rejection is not yet implemented (owner:
    Member B)" and undoes the optimistic change.

## Mocked domains

- **None.** In development every domain uses the real API (`DEV_DEFAULT_MOCKS = 'none'`).
- `VITE_USE_MOCKS=all` still runs the client fully offline on `/mocks`. That is for UI work only,
  and a production build never mocks.

## Partially implemented / behaviour to know

- **There is no "generate summaries" button, by design.**
  - Summaries are written by the pipeline's `summarising` stage, and the contract has no
    summary-generation route.
  - To regenerate them, reprocess from `summarising` (teacher lectures table). That replaces the
    lecture's summaries with new `pending_review` ones, so approved ones must be re-approved.
- **A summary is shown to students only once its topic section is approved too.**
  - Teachers approve topics in the Review queue's **Topics** tab (added 2026-11-01; before that
    there was no UI for it, so topics stayed pending and students saw "No summaries yet").
- **Lectures indexed late are indexed on first search.**
  - Lectures processed before the `indexing` stage existed, seeded data, or a failed indexing run
    have chunks without embeddings.
  - The first vector/hybrid search or question on such a lecture embeds them, which costs about 1 s
    per lecture once.
  - The lecture's `indexing` stage record still says `skipped` for those older lectures.
- **When a model citation is dropped, its sentence stays in the answer without a marker.**
  - An answer is returned only when at least one citation survives validation.
  - Seen on the Hindi–English lecture: the model's second quote was stitched together with "…", so
    it was dropped.

- **Topic segmentation runs the `fixed_window` baseline (300 s)** in the pipeline.
  - The proposed `embedding_similarity` method now runs, and was evaluated on 2 lectures with
    opposite results: F1 0.333 vs 0 on the English lecture, but no boundaries at all on the
    Hindi–English one.
  - Switching is Member B's decision; see `evaluation/topics/README.md`.
- **Topic labels on Hindi–English lectures fall back to TF-IDF when the LLM is rate-limited.** The
  fallback has no Hindi stop list, so labels can be words like "हैं में account".
- **Reprocessing a lecture from `segmenting` deletes its questions.** Attempts are kept as history.
  An attempt that refers to a deleted question shows its stored score, but `correctOptionId` is
  `null` and the explanation reads "removed when the lecture was reprocessed".
- **A failed `indexing` stage marks the lecture `failed`.**
  - The transcript, topics and summaries are kept, but students cannot see a failed lecture.
  - A teacher reprocesses from `indexing`, which is cheap and does not re-transcribe.
- **The embedding model is downloaded on first use** (about 23 MB, from the Hugging Face hub) into
  `node_modules/@xenova/transformers/.cache`.
  - An offline server cannot index, search or ask until that cache exists.
  - Indexing then fails with the actionable message above, and search/ask return 500.
- **Free-tier LLM quotas (Groq `openai/gpt-oss-120b`): 8 000 tokens/minute and 200 000
  tokens/day.**
  - One `/ask` on a Hindi–English lecture is a ~8 000-character prompt.
  - On 2026-11-01/02 the **daily** quota ran out (198 629/200 000), largely from our evaluation runs.
    Asking and question generation then return `503 PROVIDER_UNAVAILABLE` with `retryAfterSec`
    ("try again in about N minutes"), quickly and without retries.
  - Everything that does not need the LLM keeps working: search, transcripts, summaries already
    generated, approved quizzes and attempts.
  - A different `LLM_MODEL` or a paid tier has its own quota; that is a configuration choice.
- **Earlier per-minute behaviour:**
  - `/ask`, question generation and summaries share it.
  - Under load, answers wait up to ~20 s per retry (the client honours `Retry-After`).
  - If the limit persists, `/ask` returns `503 PROVIDER_UNAVAILABLE`, an error and not a fake answer.
  - In one evaluation run, before the `Retry-After` fix, 13/30 questions failed this way.

## ASR (Member A)

- **The WER/CER evaluation has not been run:** the reference transcripts (`evaluation/asr/reference/`)
  are not typed yet, so `evaluation/asr/results.csv` and `FAILURES.md` are empty.
- **Only one source recording:** a third-party Hindi–English lecture. No accented-speaker or
  real-classroom-noise clip exists.
- **Whisper output is not deterministic.** Re-transcribing shifts segment indexes, which is why
  the topic annotations depend on a frozen transcript that is kept local and not committed.

## Retrieval and grounded Q&A (Member C) — `evaluation/rag/README.md`

- **Retrieval (20 answerable questions):**
  - hybrid: Recall@1 0.95, Recall@5 1.00, MRR 0.960;
  - keyword and vector: Recall@1 0.90.
- **Grounded QA (30 questions, latest run):**
  - 18/20 answerable questions answered (19/20 in the previous run: the model varies between runs);
  - abstention recall 10/10 and precision 10/12;
  - citation correctness 18/18.
- **These numbers are optimistic:**
  - one synthetic lecture;
  - questions written by an AI assistant from the transcript text, not yet reviewed by a teammate;
  - the relevance threshold was chosen on the same questions.
- **The relevance gate has two signals:** a cosine threshold (0.35) OR "a retrieved passage
  contains all of the question's content words".
  - It still blocks some answerable questions whose wording does not match the lecture's (q02).
  - It still blocks questions with no content words, such as "What is this lecture about?" or
    "summarize the lecture".
  - It lets on-topic unanswerable questions through to the LLM: 4/10 on the gold set, all of which
    the model then declined.
- **Citation validation proves the quote is verbatim in the cited chunk, not that the quote
  supports the sentence citing it.** In one run, an answer (q01) cited real quotes for a reason the lecture
  does not give.
- **Chunks overlap by 15 s**, so the same sentence can be cited twice under two markers.
- **Citation markers are the retrieved-passage numbers** (`[2]`, `[5]`…), not 1, 2, 3, as
  the contract allows.
- **The embedding model is English-only:** semantic search and Q&A on Hindi–English lectures are
  weak, and keyword search does better there.
- **Brute-force vector search over an in-memory cache:** fine for hundreds of chunks. At larger
  scale it would move to Atlas Vector Search; there is no vector database by design.

## Quizzes and revision (Member C)

- **No teacher review of generated questions yet.**
  - 40 were generated on Lecture 7 (`evaluation/rag/question_ratings.csv`), all `pending_review`,
    every quote located (0 discarded).
  - Approval rate: **n/a** until a teammate rates them.
- **Generation is synchronous** (`201`, as the contract specifies). Large counts make the teacher
  wait for several LLM calls.
- **Quizzes draw randomly from approved questions.** There is no difficulty balancing and no
  spaced repetition.
- **Quizzes are personal practice quizzes (CONTRACTS.md §5.7).**
  - A student builds their own with "New practice quiz" from the teacher's approved questions.
  - A quiz is visible only to its creator and the lecture's owner, so **a teacher cannot assign a
    quiz to students**. That would be a contract change.
- **Revision plan rules are transparent but simple:**
  - `0.6·(1 − accuracy) + 0.3·[below class average] + 0.1·[missed on latest attempt]`;
  - the "class average" includes the student's own answers;
  - topics answered perfectly can still appear when fewer than 5 topics were attempted.

## Evaluation datasets

| Dataset | Size | Who labelled it | Caveat |
| --- | --- | --- | --- |
| ASR references | 4 clips | — | not typed yet; no WER/CER |
| Topic boundaries | 2 lectures | AI assistant | 1 synthetic; the real one is third-party and kept local; no inter-annotator agreement |
| RAG gold questions | 30 (20 answerable, 10 not) | AI assistant, from transcript text | 1 synthetic lecture; not reviewed by a teammate |
| MCQ ratings | 40 questions | nobody yet | ratings empty |
