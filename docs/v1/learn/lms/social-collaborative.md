# Social Collaborative
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/social-collaborative` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /lms/social-collaborative`, `GET /lms/social-collaborative/lookups/subjects`, `GET /lms/social-collaborative/lookups/chapters`, `GET /lms/social-collaborative/lookups/topics`, `GET /lms/social-collaborative/{id}`, `POST /lms/social-collaborative`, `POST /lms/social-collaborative/{id}/comments` |
| Roles | Student (post/comment), Teacher (post/comment/moderate), Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
A subject-linked social feed where students and teachers post questions, discussions, and resources tied to subjects, chapters, and topics. Posts can be public (visible to class) or private (locked). Users comment on posts. Paginated feed loads 10 posts at a time. Used for collaborative learning and peer discussion.

## 2. Screens

### Social Collaborative feed — `/lms/social-collaborative`
Shows: subject/chapter/topic filter dropdowns, search bar, feed of posts (title, body, author avatar + initials, time-ago label, subject/chapter/topic tags, public/private badge, comment count), create post button.
Main actions: create post, search posts, filter by subject/chapter/topic, comment on post, load more.
![](./screenshots/social-collaborative.png)

### Post detail (inline thread)
Shows: full post with all comments.
Main actions: add comment.

## 3. Features & business rules

**Post fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| Title | Text | Yes | — |
| Body | Textarea | Yes | — |
| Attachment | File | No | Optional file attach |
| Subject | Dropdown | No | From `fetchSubjects()` |
| Chapter | Dropdown | No | From `fetchChapters()` |
| Topic | Dropdown | No | From `fetchTopics()` |
| Visibility | Toggle: public / private | Yes | Public = globe icon, Private = lock icon |

**Pagination:** 10 posts per page (`PER_PAGE = 10`).

**Time label:** `timeAgo()` — "Yesterday", "N days ago", "N months ago", "N years ago" using API's `total_days` field.

**Visibility:** public posts visible to all class members; private posts visible only to creator + teacher.

## 4. User flows

**Post:**
1. Open `/lms/social-collaborative`.
2. Click "+ Create post".
3. Fill title, body, optional subject/chapter/topic, set visibility.
4. `POST /lms/social-collaborative` → post appears in feed.

**Comment:**
1. Click post to open thread (`GET /lms/social-collaborative/{id}`).
2. Type comment → `POST /lms/social-collaborative/{id}/comments`.
3. Comment appears in thread.

**Filter:**
1. Select subject → chapter → topic from filter dropdowns.
2. Feed filters to matching posts.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_social_collaborative` (TBD name) | `id`, `title`, `body`, `author_id`, `subject_id`, `chapter_id`, `topic_id`, `visibility`, `attachment_path`, `created_at` | Posts |
| `lms_sc_comments` (TBD name) | `id`, `post_id`, `author_id`, `body`, `created_at` | Comments |

`ScPost` type: `{ id, title, body, authorName, createdAt, totalDays, subjectName, chapterName, topicName, visibility, commentCount, attachmentUrl? }`
`ScComment` type: `{ id, postId, authorName, body, createdAt }`

## 6. APIs

| Method | Endpoint | Auth | Middleware | Notes |
|---|---|---|---|---|
| GET | `/lms/social-collaborative` | JWT | `api.session` | Paginated feed |
| POST | `/lms/social-collaborative` | JWT | `api.session` | Create post |
| GET | `/lms/social-collaborative/{id}` | JWT | `api.session` | Post + thread |
| POST | `/lms/social-collaborative/{id}/comments` | JWT | `api.session` | Add comment |
| GET | `/lms/social-collaborative/lookups/subjects` | JWT | `api.session` | Subject options |
| GET | `/lms/social-collaborative/lookups/chapters` | JWT | `api.session` | Chapter options |
| GET | `/lms/social-collaborative/lookups/topics` | JWT | `api.session` | Topic options |

## 7. UI components & design tokens
- `initials()` utility — avatar fallback
- `timeAgo()` utility — relative time labels
- Lucide icons: `AlertTriangle`, `Globe`, `Lock`, `MessageSquare`, `Paperclip`, `Plus`, `RefreshCw`, `Search`, `Send`, `Users`, `X`
- Feed loads in `PER_PAGE = 10` batches
- `friendlyError()` for API error messages

## 8. Reports & exports
No export in v1.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| SC-01 | Create public post | Fill form, set public, submit | Post in feed with globe icon | Happy |
| SC-02 | Create private post | Set private | Post with lock icon; only creator + teacher see it | Happy |
| SC-03 | Comment | Click post, type comment, send | Comment appears in thread | Happy |
| SC-04 | Filter by subject | Select subject | Only that subject's posts show | Happy |
| SC-05 | Load more | Scroll to end, click load more | Next 10 posts appear | Happy |
| SC-06 | Time label | Post from 3 days ago | Shows "3 days ago" | Happy |

## 10. Known issues, limitations & FAQs
- Private post visibility enforcement is backend-controlled; frontend only shows the lock icon — it does not filter client-side.
- No moderation/delete post feature visible in v1 frontend code (teacher moderation may exist in backend only).

## 11. Sales notes
- **Selling point**: structured academic social feed — not social media, but subject-linked discussion tied to chapters and topics.
- **Demo flow**: (1) Student posts question on chapter; (2) teacher replies; (3) filter feed by subject; (4) show private post visible only to teacher.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. Create, comment, filter, pagination all functional.
- v2: Reactions/upvotes; teacher-pin best answer; moderation queue; notification on reply.

## Source files
- `C:\rajesh\lms_k12\app\lms\social-collaborative\page.tsx`
- `C:\rajesh\lms_k12\app\lms\data\socialCollaborative.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\api\lms\LmsSocialCollaborativeApiController.php`
