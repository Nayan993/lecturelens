# Retrieval & grounded-QA evaluation (Member C)

```
npx tsx evaluation/rag/evaluate-retrieval.ts   # results.csv, retrieval-details.csv, gate-calibration.csv
npx tsx evaluation/rag/evaluate-qa.ts          # results-qa.csv, qa-details.json — REAL LLM calls
```

Both scripts load the lecture into a **throwaway in-memory MongoDB** (`lecture.ts`; never Atlas).
The lecture is chunked with Member B's chunker (60 s windows, 15 s overlap → 26 chunks) and indexed
with the real `embedLecture()`. So they run the same `retrieve()` / `answerQuestion()` code as
`POST /search` and `POST /ask`. `evaluate-qa.ts` calls the LLM configured in `server/.env` (Groq,
`openai/gpt-oss-120b`); `evaluate-retrieval.ts` needs no API key.

## Read this first — what the numbers can and cannot say

- **One lecture, and it is synthetic.**
  - All 30 questions are about Lecture 7 (`mocks/transcript.json`), a fixture transcript, not a
    recording.
  - The real Hindi–English recording used elsewhere is third-party content and is not in the
    repository, so a gold set built on it could not be reproduced.
- **The gold labels were written by an AI assistant (`claude-assistant`) from the transcript TEXT,
  not by watching the lecture, and no teammate has reviewed them yet.**
  - Questions were paraphrased on purpose, but whoever writes them knows the wording.
  - That is why recall is near the ceiling here; expect it to fall on real students' questions.
- **The models are pretrained and used as is:** Xenova/all-MiniLM-L6-v2 (embeddings) and the hosted
  LLM. Nothing was trained or fine-tuned.
- **The relevance-gate threshold (0.35) was chosen on these same 30 questions.**
  - It is therefore an in-sample number, not a held-out one.
- **Free-tier rate limit:** Groq allows about 8 000 tokens a minute.
  - Latency below includes the client's back-off on HTTP 429.
  - Unthrottled answers took about 1.4–3 s (q01–q04).

## Dataset — `qa_labels.json`

- **30 questions:** 20 answerable and 10 deliberately unanswerable.
- **Answerable:** each has a gold span `[relevantStartSec, relevantEndSec]`, the transcript
  segment(s) that answer it, plus a short reference answer (used only to judge the failure cases
  below).
- **Unanswerable:** on-topic for a deep-learning course but not covered by this lecture (Adam
  betas, dropout rate, cross-entropy, batch normalisation, …).

## Retrieval — `results.csv` (20 answerable questions, real run 2026-11-01)

A retrieved chunk is a **hit** if its time range **overlaps** the gold span (start < gold end and
end > gold start). Defining hits by overlap avoids any argument about chunk boundaries.
**MRR** = mean of 1/rank of the first hit within the top 10 (0 if none).

| Retriever | Recall@1 | Recall@5 | Recall@10 | MRR | mean / p95 latency |
| --- | ---: | ---: | ---: | ---: | ---: |
| keyword (BM25) | 0.90 | 0.95 | 1.00 | 0.932 | 3.9 / 4.6 ms |
| vector (cosine) | 0.90 | 0.95 | 1.00 | 0.933 | 5.4 / 7.9 ms |
| hybrid (RRF) | **0.95** | **1.00** | 1.00 | **0.960** | 10.1 / 15.3 ms |

- **Index:** 26 chunks embedded in ≈ 1.3 s on CPU.
- **Latency:** in process, warm vector cache, excluding the one-off model load.
- **Search:** brute-force cosine over in-memory vectors. At this scale it takes microseconds, so
  there is no vector database. At larger scale the design swaps to Atlas Vector Search.

## Grounded QA — `results-qa.csv` (30 questions, hybrid, top-8, latest real run 2026-11-01)

| Metric | Value |
| --- | --- |
| Answered / abstained | 18 / 12 (abstained: 7 `NO_RELEVANT_PASSAGE` before the LLM, 5 `LOW_CONFIDENCE`, 0 `PARSE_FAILED`) |
| Answerable questions answered | 18 / 20 = 0.90 |
| **Citation validity** — every citation's span lies in its chunk and its quote is in that chunk | 28 / 28 citations (1.00); guaranteed by the server-side validator, so this checks the code, not the model |
| **Citation correctness** — answered answerable questions with ≥ 1 citation overlapping the gold span | 18 / 18 = 1.00 |
| **Abstention precision** — abstentions that were really unanswerable | 10 / 12 = 0.833 |
| **Abstention recall** — unanswerable questions that abstained | 10 / 10 = 1.00 |
| Latency (end to end, incl. 429 back-off) | mean 11.9 s, p95 22.4 s |

**Run-to-run variation.**
- The previous full run, before the long-quote fix below, answered 19/20 with abstention
  precision 10/11. The only difference is q01, which this run abstained on (`LOW_CONFIDENCE`) and
  the previous run answered wrongly (case 1).
- The hosted model is not deterministic even at temperature 0, so expect ±1 question between runs.
- **Long-quote fix (2026-11-01):** a verbatim quote over the 300-character evidence limit is now
  trimmed at a word boundary instead of dropped. It was found on the real Hindi–English lecture,
  where a correct answer was being forced to `LOW_CONFIDENCE`.
  - It can only keep citations that were previously dropped; it never adds one that is not verbatim
    in the chunk.

**Relevance gate (`gate-calibration.csv`).** This is the best cosine similarity between the question
and its top-8 hybrid passages:
- answerable questions: 0.277–0.764;
- unanswerable questions: 0.156–0.539.

At 0.35:
- 19/20 answerable questions reach the LLM;
- 6/10 unanswerable ones are stopped before it.

At 0.40 it would be 18/20 and 8/10. We chose 0.35 because a wrong retrieval-side abstention cannot
be recovered, while an unanswerable question that passes the gate still meets the generation-side
checks (as all four did here). See `docs/DECISIONS.md`.

**Correctness, judged by hand against the reference answers** (assistant judgement, not a metric):
- in the previous run, 18 of 19 answers were correct and 1 (q01) gave a reason the lecture does not
  give (case 1);
- in this run, all 18 answers match their reference answers.

## Failure cases (all observed in the runs above)

1. **q01 — retrieval found the right passage; the answer is still wrong (previous run; this run abstained instead).**
   - The question: why can't neural networks use a closed-form solution?
   - The top-ranked chunk is the gold passage: "inverting a matrix that is d by d … for a neural
     network there is no closed form at all".
   - The model instead answered that the reason is the non-convex loss surface ("many local minima,
     plateaus and saddle points"). That is true of neural networks, but it is not the reason the
     lecture gives.
   - Both citations survived validation: each quote is verbatim in its chunk.
   - So the validator proves the quotes exist, not that they support the sentence that cites them.
   - This is the one answer of the 19 judged wrong. The playbook asks for two cases of this kind,
     and only one occurred in this run; we report it rather than invent a second.
2. **q02 — retrieval was right; the relevance gate abstained anyway.**
   - "How expensive is solving the normal equations?": all three retrievers ranked the gold chunk
     **first** (`retrieval-details.csv`).
   - Its cosine similarity was only 0.277 ("expensive" vs "costs roughly d cubed"), so `/ask`
     returned `NO_RELEVANT_PASSAGE` without calling the LLM.
   - This is the gate's only false abstention, and the reason the threshold was not raised further.
3. **Unanswerable questions that pass the gate cost an LLM call.**
   - q23 batch norm (0.509), q26 inventor of backprop (0.539), q27 warm-up (0.390) and q29 weight
     decay (0.398) share vocabulary with the lecture.
   - They passed the 0.35 gate, and the model then abstained (`LOW_CONFIDENCE`).
   - The outcome was right, but it cost 12–16 s and rate-limit budget each.
   - The gate is a cheap first filter, not a classifier.
4. **q11 — a neighbouring passage outranks the gold one in every retriever.**
   - "Why is each full-batch gradient step expensive?": the gold chunk (467–491 s) ranks 7th
     (keyword), 6th (vector) and 5th (hybrid).
   - The SGD chunk that follows ("each step costs one example instead of a million") shares more of
     the question's words.
   - The answer was still correct because top-8 included the gold chunk. With top-3 it would not
     have been.
5. **Duplicate citations from overlapping chunks.**
   - Chunks overlap by 15 s, so the same sentence is in two chunks.
   - The model then cites both with the same quote: q03, q04, q06, q08, q15, q18, q20.
   - Each citation is valid, but the UI shows the same evidence twice under two markers.
   - Not fixed: de-duplicating by quote would change the contract's 1:1 marker → citation mapping.
6. **Rate limits turned answers into errors before the retry fix.**
   - In the first full run, **13 of 30 questions failed with `503 PROVIDER_UNAVAILABLE`**. The
     shared client retried a 429 for only 1 + 2 + 4 s, while Groq asked for longer waits.
   - The client now honours `Retry-After` (capped at 20 s), and the script retries a question after
     30 s. The run above had 0 errors.
   - In the app, a student asking during a burst can still get a 503, an honest error, not a fake
     answer.

## MCQ generation and the teacher-rating sheet (PC.3) — `question_ratings.csv`

**What was generated:**
- 40 questions on Lecture 7's 4 approved topic sections, from 7 real generation requests through
  `POST /lectures/:id/questions/generate` (`openai/gpt-oss-120b`, prompt `mcq-v1`) on the
  local E2E stack, 2026-11-01.
- Every generated question was saved **`pending_review`**.
- Each supporting quote was located in its own section's transcript: **40/40** were located and
  **0** were discarded as unlocatable. Each row carries the evidence second and quote.

**No teacher review has happened yet**, so these columns are empty on purpose:
- reviewer, validity, answerability, rated difficulty, decision, rejection reason.
- **Approval rate and rejection-reason tally: n/a** until a teammate fills them in.
- In the throwaway test database, 6 of these questions were approved by the end-to-end script (to
  build a quiz) and 1 was rejected while testing the UI. That was not a review.
- Do not report those statuses as an approval rate.

How to rate (playbook PC.3):
- the reviewer answers **validity** (answerable from the lecture?), **answerability** (exactly one
  correct option?) and **difficulty** for each row;
- then gives a decision, with a `rejectionReason` from the contract enum when rejecting;
- approval rate = approved / 40.

## Files
| File | |
| --- | --- |
| `qa_labels.json` | The 30 gold questions (see the caveats above). |
| `lecture.ts` | Loads Lecture 7 into an in-memory MongoDB, chunks and indexes it. |
| `evaluate-retrieval.ts`, `evaluate-qa.ts` | The two evaluations. |
| `results.csv`, `retrieval-details.csv`, `gate-calibration.csv` | Retrieval output (script-generated). |
| `results-qa.csv`, `qa-details.json` | QA output: every answer, citation and latency (script-generated; Lecture 7 is our own fixture). |
| `question_ratings.csv` | MCQ teacher-rating sheet (PC.3) — see the note in that file. |
