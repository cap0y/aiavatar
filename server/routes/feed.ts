import { Router } from "express";
import { db } from "../db";
import {
  feedPosts,
  feedPostComments,
  feedPostVotes,
  feedPostCommentVotes,
  feedPostBookmarks,
  feedPostReactions,
  feedPostReports,
  channelMessages,
  channelSubscriptions,
  users,
} from "../../shared/schema";
import { eq, desc, sql, and, or, like } from "drizzle-orm";
import multer from "multer";
import path from "path";
import { uploadToCloudinary } from "../cloudinary";

const router = Router();

// Cloudinary CDN 설정
console.log("☁️ Feed 파일 업로드: Cloudinary 사용");

// 메모리에 임시 저장 후 Cloudinary로 전송
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("이미지 또는 비디오 파일만 업로드 가능합니다."));
    }
  },
});

// 다중 파일 업로드를 위한 미들웨어 (최대 10개)
const uploadMultiple = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("이미지 또는 비디오 파일만 업로드 가능합니다."));
    }
  },
}).array("media", 10); // 최대 10개 파일

// 포스트 목록 조회 (페이지네이션)
router.get("/posts", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const filterUserId = req.query.userId as string; // 특정 사용자의 포스트만 필터링
    const sortBy = (req.query.sortBy as string) || 'latest'; // 정렬 기준
    const currentUserId = req.query.userId as string; // 현재 로그인한 사용자 ID (구독순 정렬용)

    // 포스트 목록과 작성자 정보 조회
    let query = db
      .select({
        id: feedPosts.id,
        title: feedPosts.title,
        content: feedPosts.content,
        mediaType: feedPosts.mediaType,
        mediaUrl: feedPosts.mediaUrl,
        mediaUrls: feedPosts.mediaUrls, // 다중 이미지 URL 배열 추가
        thumbnailUrl: feedPosts.thumbnailUrl,
        youtubeUrl: feedPosts.youtubeUrl,
        upvotes: feedPosts.upvotes,
        downvotes: feedPosts.downvotes,
        commentCount: feedPosts.commentCount,
        viewCount: feedPosts.viewCount,
        reportCount: feedPosts.reportCount, // 신고 횟수 추가
        createdAt: feedPosts.createdAt,
        userId: feedPosts.userId,
        userName: users.displayName,
        userAvatar: users.photoURL,
      })
      .from(feedPosts)
      .leftJoin(users, eq(feedPosts.userId, users.id));

    // 구독순 필터링 - 구독한 채널의 포스트만 표시
    if (sortBy === 'subscribed' && currentUserId) {
      query = query.innerJoin(
        channelSubscriptions,
        and(
          eq(channelSubscriptions.channelUserId, feedPosts.userId),
          eq(channelSubscriptions.subscriberId, currentUserId)
        )
      ) as any;
    }

    // userId 필터링 적용
    if (filterUserId && sortBy !== 'subscribed') {
      query = query.where(eq(feedPosts.userId, filterUserId)) as any;
    }

    // 정렬 기준에 따라 orderBy 적용
    let posts;
    switch (sortBy) {
      case 'popular': // 좋아요순
        posts = await query
          .orderBy(desc(feedPosts.upvotes))
          .limit(limit)
          .offset(offset);
        break;
      
      case 'trending': // 급상승 (최근 24시간 좋아요 + 댓글 + 조회수)
        posts = await query
          .orderBy(
            desc(
              sql`(
                ${feedPosts.upvotes} * 3 + 
                ${feedPosts.commentCount} * 2 + 
                ${feedPosts.viewCount} * 0.1
              ) / POWER(EXTRACT(EPOCH FROM (NOW() - ${feedPosts.createdAt})) / 3600 + 2, 1.5)`
            )
          )
          .limit(limit)
          .offset(offset);
        break;
      
      case 'subscribed': // 구독순 (최신순으로 정렬)
        posts = await query
          .orderBy(desc(feedPosts.createdAt))
          .limit(limit)
          .offset(offset);
        break;
      
      case 'latest': // 최신순
      default:
        posts = await query
          .orderBy(desc(feedPosts.createdAt))
          .limit(limit)
          .offset(offset);
        break;
    }

    // 현재 사용자의 투표 정보 조회 (로그인한 경우)
    const userId = req.headers["x-user-id"] as string;
    let userVotes: Record<number, string> = {};

    if (userId && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const votes = await db
        .select()
        .from(feedPostVotes)
        .where(
          sql`${feedPostVotes.postId} IN ${postIds} AND ${feedPostVotes.userId} = ${userId}`,
        );

      userVotes = votes.reduce(
        (acc, vote) => {
          acc[vote.postId!] = vote.voteType!;
          return acc;
        },
        {} as Record<number, string>,
      );
    }

    // 이모티콘 반응 정보 조회
    const postsWithReactions = await Promise.all(
      posts.map(async (post) => {
        // 해당 포스트의 모든 이모티콘 반응 조회
        const reactions = await db
          .select({
            emoji: feedPostReactions.emoji,
            count: sql<number>`cast(count(*) as integer)`,
          })
          .from(feedPostReactions)
          .where(eq(feedPostReactions.postId, post.id))
          .groupBy(feedPostReactions.emoji);

        // 현재 사용자가 누른 이모티콘 조회
        let userReactions: string[] = [];
        if (userId) {
          const userReacted = await db
            .select({ emoji: feedPostReactions.emoji })
            .from(feedPostReactions)
            .where(
              and(
                eq(feedPostReactions.postId, post.id),
                eq(feedPostReactions.userId, userId),
              ),
            );
          userReactions = userReacted.map((r) => r.emoji);
        }

        return {
          ...post,
          userVote: userVotes[post.id] || null,
          reactions: reactions || [],
          userReactions: userReactions || [],
        };
      }),
    );

    res.json({
      posts: postsWithReactions,
      page,
      limit,
      hasMore: posts.length === limit,
    });
  } catch (error) {
    console.error("포스트 목록 조회 실패:", error);
    res.status(500).json({ error: "포스트 목록을 불러오는데 실패했습니다." });
  }
});

// 포스트 상세 조회
router.get("/posts/:id", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    // 포스트 조회
    const post = await db
      .select({
        id: feedPosts.id,
        title: feedPosts.title,
        content: feedPosts.content,
        mediaType: feedPosts.mediaType,
        mediaUrl: feedPosts.mediaUrl,
        mediaUrls: feedPosts.mediaUrls,
        thumbnailUrl: feedPosts.thumbnailUrl,
        youtubeUrl: feedPosts.youtubeUrl,
        upvotes: feedPosts.upvotes,
        downvotes: feedPosts.downvotes,
        commentCount: feedPosts.commentCount,
        viewCount: feedPosts.viewCount,
        createdAt: feedPosts.createdAt,
        userId: feedPosts.userId,
        userName: users.displayName,
        userAvatar: users.photoURL,
      })
      .from(feedPosts)
      .leftJoin(users, eq(feedPosts.userId, users.id))
      .where(eq(feedPosts.id, postId))
      .limit(1);

    if (post.length === 0) {
      return res.status(404).json({ error: "포스트를 찾을 수 없습니다." });
    }

    // 조회수 증가
    await db
      .update(feedPosts)
      .set({ viewCount: sql`${feedPosts.viewCount} + 1` })
      .where(eq(feedPosts.id, postId));

    // 현재 사용자의 투표 정보 조회
    const userId = req.headers["x-user-id"] as string;
    let userVote = null;

    if (userId) {
      const vote = await db
        .select()
        .from(feedPostVotes)
        .where(
          sql`${feedPostVotes.postId} = ${postId} AND ${feedPostVotes.userId} = ${userId}`,
        )
        .limit(1);

      userVote = vote.length > 0 ? vote[0].voteType : null;
    }

    res.json({
      ...post[0],
      userVote,
    });
  } catch (error) {
    console.error("포스트 조회 실패:", error);
    res.status(500).json({ error: "포스트를 불러오는데 실패했습니다." });
  }
});

// 포스트 생성 (다중 파일 지원)
router.post("/posts", uploadMultiple, async (req, res) => {
  try {
    // Firebase 사용자 ID를 헤더에서 가져오기
    const userId = (req.headers["x-user-id"] as string) || "anonymous";

    const { title, content, mediaType, youtubeUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: "제목은 필수입니다." });
    }

    let mediaUrls: string[] = [];
    let firstMediaUrl = null;

    // 다중 파일이 있으면 Cloudinary로 업로드
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        console.log(`☁️ Cloudinary로 ${req.files.length}개 파일 업로드 중...`);

        for (const file of req.files) {
          console.log("📤 파일 업로드 중:", {
            originalname: file.originalname,
            size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          });

          // 파일 타입에 따라 리소스 유형 결정
          const resourceType = file.mimetype.startsWith("video/") ? "video" as const : "image" as const;

          const result = await uploadToCloudinary(file.buffer, "feed-media", {
            resourceType,
          });

          mediaUrls.push(result.url);
          if (!firstMediaUrl) {
            firstMediaUrl = result.url;
          }
        }

        console.log(`✅ 총 ${mediaUrls.length}개 파일 Cloudinary 업로드 완료`);
      } catch (uploadError) {
        console.error("❌ Cloudinary 업로드 실패:", uploadError);
        return res.status(500).json({
          error: "파일 업로드에 실패했습니다.",
          details:
            uploadError instanceof Error
              ? uploadError.message
              : "Unknown error",
        });
      }
    }

    const newPost = await db
      .insert(feedPosts)
      .values({
        userId: userId,
        title,
        content: content || null,
        mediaType: mediaType || null,
        mediaUrl: firstMediaUrl || null, // 첫 번째 이미지 (하위 호환성)
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : null, // 모든 이미지 배열
        thumbnailUrl: null,
        youtubeUrl: youtubeUrl || null,
      })
      .returning();

    res.status(201).json(newPost[0]);
  } catch (error) {
    console.error("포스트 생성 실패:", error);
    res.status(500).json({ error: "포스트 생성에 실패했습니다." });
  }
});

// 포스트 수정 (다중 파일 지원)
router.put("/posts/:id", uploadMultiple, async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const userType = req.headers["x-user-type"] as string;
    const postId = parseInt(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    // 포스트 소유자 확인
    const [post] = await db
      .select()
      .from(feedPosts)
      .where(eq(feedPosts.id, postId))
      .limit(1);

    if (!post) {
      return res.status(404).json({ error: "포스트를 찾을 수 없습니다." });
    }

    // 관리자이거나 게시물 소유자만 수정 가능
    if (post.userId !== userId && userType !== "admin") {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    const { title, content, youtubeUrl, mediaType } = req.body;

    if (!title) {
      return res.status(400).json({ error: "제목은 필수입니다." });
    }

    let mediaUrls = (post.mediaUrls as string[]) || []; // 기존 미디어 URLs 유지
    let firstMediaUrl = post.mediaUrl;

    // 새 파일들이 있으면 Cloudinary로 업로드
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      try {
        console.log(`☁️ Cloudinary로 ${req.files.length}개 파일 업로드 중...`);

        const newMediaUrls: string[] = [];

        for (const file of req.files) {
          console.log("📤 파일 업로드 중:", {
            originalname: file.originalname,
            size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          });

          const resourceType = file.mimetype.startsWith("video/") ? "video" as const : "image" as const;

          const result = await uploadToCloudinary(file.buffer, "feed-media", {
            resourceType,
          });

          newMediaUrls.push(result.url);
        }

        // 새로 업로드된 파일들로 교체
        mediaUrls = newMediaUrls;
        firstMediaUrl = newMediaUrls[0] || null;
        console.log(`✅ 총 ${mediaUrls.length}개 파일 Cloudinary 업로드 완료`);
      } catch (uploadError) {
        console.error("❌ Cloudinary 업로드 실패:", uploadError);
        return res.status(500).json({
          error: "파일 업로드에 실패했습니다.",
          details:
            uploadError instanceof Error
              ? uploadError.message
              : "Unknown error",
        });
      }
    }

    // 포스트 업데이트
    const [updatedPost] = await db
      .update(feedPosts)
      .set({
        title,
        content: content || null,
        mediaType: mediaType || post.mediaType,
        mediaUrl: firstMediaUrl || null,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
        youtubeUrl: youtubeUrl || null,
        updatedAt: sql`now()`,
      })
      .where(eq(feedPosts.id, postId))
      .returning();

    res.json(updatedPost);
  } catch (error) {
    console.error("포스트 수정 실패:", error);
    res.status(500).json({ error: "포스트 수정에 실패했습니다." });
  }
});

// 포스트 투표
router.post("/posts/:id/vote", async (req, res) => {
  try {
    const userId = (req.headers["x-user-id"] as string) || "anonymous";

    const postId = parseInt(req.params.id);
    const { voteType } = req.body; // "upvote" or "downvote"

    if (!["upvote", "downvote"].includes(voteType)) {
      return res.status(400).json({ error: "잘못된 투표 타입입니다." });
    }

    // 기존 투표 확인
    const existingVote = await db
      .select()
      .from(feedPostVotes)
      .where(
        sql`${feedPostVotes.postId} = ${postId} AND ${feedPostVotes.userId} = ${userId}`,
      )
      .limit(1);

    if (existingVote.length > 0) {
      // 같은 투표면 취소, 다른 투표면 변경
      if (existingVote[0].voteType === voteType) {
        // 투표 취소
        await db
          .delete(feedPostVotes)
          .where(
            sql`${feedPostVotes.postId} = ${postId} AND ${feedPostVotes.userId} = ${userId}`,
          );

        // 카운트 감소
        if (voteType === "upvote") {
          await db
            .update(feedPosts)
            .set({ upvotes: sql`${feedPosts.upvotes} - 1` })
            .where(eq(feedPosts.id, postId));
        } else {
          await db
            .update(feedPosts)
            .set({ downvotes: sql`${feedPosts.downvotes} - 1` })
            .where(eq(feedPosts.id, postId));
        }

        return res.json({
          message: "투표가 취소되었습니다.",
          action: "cancelled",
        });
      } else {
        // 투표 변경
        await db
          .update(feedPostVotes)
          .set({ voteType })
          .where(
            sql`${feedPostVotes.postId} = ${postId} AND ${feedPostVotes.userId} = ${userId}`,
          );

        // 이전 투표 감소, 새 투표 증가
        if (voteType === "upvote") {
          await db
            .update(feedPosts)
            .set({
              upvotes: sql`${feedPosts.upvotes} + 1`,
              downvotes: sql`${feedPosts.downvotes} - 1`,
            })
            .where(eq(feedPosts.id, postId));
        } else {
          await db
            .update(feedPosts)
            .set({
              upvotes: sql`${feedPosts.upvotes} - 1`,
              downvotes: sql`${feedPosts.downvotes} + 1`,
            })
            .where(eq(feedPosts.id, postId));
        }

        return res.json({
          message: "투표가 변경되었습니다.",
          action: "changed",
        });
      }
    } else {
      // 새 투표 추가
      await db.insert(feedPostVotes).values({
        postId,
        userId: userId,
        voteType,
      });

      // 카운트 증가
      if (voteType === "upvote") {
        await db
          .update(feedPosts)
          .set({ upvotes: sql`${feedPosts.upvotes} + 1` })
          .where(eq(feedPosts.id, postId));
      } else {
        await db
          .update(feedPosts)
          .set({ downvotes: sql`${feedPosts.downvotes} + 1` })
          .where(eq(feedPosts.id, postId));
      }

      return res.json({ message: "투표가 등록되었습니다.", action: "added" });
    }
  } catch (error) {
    console.error("투표 처리 실패:", error);
    res.status(500).json({ error: "투표 처리에 실패했습니다." });
  }
});

// 댓글 목록 조회
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.headers["x-user-id"] as string;

    const comments = await db
      .select({
        id: feedPostComments.id,
        postId: feedPostComments.postId,
        userId: feedPostComments.userId,
        parentId: feedPostComments.parentId,
        content: feedPostComments.content,
        createdAt: feedPostComments.createdAt,
        userName: users.displayName,
        userAvatar: users.photoURL,
      })
      .from(feedPostComments)
      .leftJoin(users, eq(feedPostComments.userId, users.id))
      .where(eq(feedPostComments.postId, postId))
      .orderBy(feedPostComments.createdAt);

    // 각 댓글의 투표 수 계산
    const commentsWithVotes = await Promise.all(
      comments.map(async (comment) => {
        // 총 투표수 계산
        const votes = await db
          .select({
            voteType: feedPostCommentVotes.voteType,
          })
          .from(feedPostCommentVotes)
          .where(eq(feedPostCommentVotes.commentId, comment.id));

        const upvotes = votes.filter((v) => v.voteType === "upvote").length;
        const downvotes = votes.filter((v) => v.voteType === "downvote").length;

        // 현재 사용자의 투표 확인
        let userVote = null;
        if (userId) {
          const [existingVote] = await db
            .select()
            .from(feedPostCommentVotes)
            .where(
              and(
                eq(feedPostCommentVotes.commentId, comment.id),
                eq(feedPostCommentVotes.userId, userId),
              ),
            );

          if (existingVote) {
            userVote = existingVote.voteType;
          }
        }

        return {
          ...comment,
          upvotes,
          downvotes,
          userVote,
        };
      }),
    );

    res.json(commentsWithVotes);
  } catch (error) {
    console.error("댓글 조회 실패:", error);
    res.status(500).json({ error: "댓글을 불러오는데 실패했습니다." });
  }
});

// 댓글 삭제
router.delete("/posts/:postId/comments/:commentId", async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const userId = req.headers["x-user-id"] as string;
    const userType = req.headers["x-user-type"] as string;

    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    // 댓글 조회
    const [comment] = await db
      .select()
      .from(feedPostComments)
      .where(eq(feedPostComments.id, commentId));

    if (!comment) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다." });
    }

    // 권한 확인 (작성자 또는 관리자)
    if (comment.userId !== userId && userType !== "admin") {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    // 댓글 삭제
    await db.delete(feedPostComments).where(eq(feedPostComments.id, commentId));

    res.json({ message: "댓글이 삭제되었습니다." });
  } catch (error) {
    console.error("댓글 삭제 실패:", error);
    res.status(500).json({ error: "댓글 삭제에 실패했습니다." });
  }
});

// 댓글 투표
router.post("/posts/:postId/comments/:commentId/vote", async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const { voteType } = req.body;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    if (!["upvote", "downvote"].includes(voteType)) {
      return res.status(400).json({ error: "잘못된 투표 타입입니다." });
    }

    // 기존 투표 확인
    const [existingVote] = await db
      .select()
      .from(feedPostCommentVotes)
      .where(
        and(
          eq(feedPostCommentVotes.commentId, commentId),
          eq(feedPostCommentVotes.userId, userId),
        ),
      );

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // 같은 투표면 취소
        await db
          .delete(feedPostCommentVotes)
          .where(
            and(
              eq(feedPostCommentVotes.commentId, commentId),
              eq(feedPostCommentVotes.userId, userId),
            ),
          );
        return res.json({ message: "투표가 취소되었습니다." });
      } else {
        // 다른 투표면 변경
        await db
          .update(feedPostCommentVotes)
          .set({ voteType })
          .where(
            and(
              eq(feedPostCommentVotes.commentId, commentId),
              eq(feedPostCommentVotes.userId, userId),
            ),
          );
        return res.json({ message: "투표가 변경되었습니다." });
      }
    }

    // 새 투표 생성
    await db.insert(feedPostCommentVotes).values({
      commentId,
      userId,
      voteType,
    });

    res.json({ message: "투표가 등록되었습니다." });
  } catch (error) {
    console.error("댓글 투표 실패:", error);
    res.status(500).json({ error: "투표 처리에 실패했습니다." });
  }
});

// 댓글 작성
router.post("/posts/:id/comments", async (req, res) => {
  try {
    const userId = (req.headers["x-user-id"] as string) || "anonymous";

    const postId = parseInt(req.params.id);
    const { content, parentId } = req.body;

    if (!content) {
      return res.status(400).json({ error: "댓글 내용은 필수입니다." });
    }

    const newComment = await db
      .insert(feedPostComments)
      .values({
        postId,
        userId: userId,
        parentId: parentId || null,
        content,
      })
      .returning();

    // 댓글 수 증가
    await db
      .update(feedPosts)
      .set({ commentCount: sql`${feedPosts.commentCount} + 1` })
      .where(eq(feedPosts.id, postId));

    res.status(201).json(newComment[0]);
  } catch (error) {
    console.error("댓글 작성 실패:", error);
    res.status(500).json({ error: "댓글 작성에 실패했습니다." });
  }
});

// 포스트 삭제
router.delete("/posts/:id", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const userType = req.headers["x-user-type"] as string;

    const postId = parseInt(req.params.id);

    // 포스트 소유자 확인
    const post = await db
      .select()
      .from(feedPosts)
      .where(eq(feedPosts.id, postId))
      .limit(1);

    if (post.length === 0) {
      return res.status(404).json({ error: "포스트를 찾을 수 없습니다." });
    }

    if (post[0].userId !== userId && userType !== "admin") {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    // 미디어 파일 삭제는 Windows 서버에서 수동으로 관리
    // TODO: Windows 서버에 삭제 API 추가 시 여기서 호출

    // 포스트 삭제 (cascade로 댓글, 투표도 삭제됨)
    await db.delete(feedPosts).where(eq(feedPosts.id, postId));

    res.json({ message: "포스트가 삭제되었습니다." });
  } catch (error) {
    console.error("포스트 삭제 실패:", error);
    res.status(500).json({ error: "포스트 삭제에 실패했습니다." });
  }
});

// 인기 채널 조회 (게시물이 많은 사용자 상위 5명)
router.get("/popular-channels", async (req, res) => {
  try {
    const popularChannels = await db
      .select({
        userId: users.id,
        userName: users.displayName,
        userAvatar: users.photoURL,
        postCount: sql<number>`count(${feedPosts.id})`.as("postCount"),
      })
      .from(users)
      .leftJoin(feedPosts, eq(users.id, feedPosts.userId))
      .groupBy(users.id, users.displayName, users.photoURL)
      .having(sql`count(${feedPosts.id}) > 0`)
      .orderBy(desc(sql`count(${feedPosts.id})`))
      .limit(5);

    res.json(popularChannels);
  } catch (error) {
    console.error("인기 채널 조회 실패:", error);
    res.status(500).json({ error: "인기 채널을 불러오는데 실패했습니다." });
  }
});

// 구독한 채널 조회
router.get("/subscribed-channels", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.json([]);
    }

    // 구독한 채널 목록 조회
    const subscribedChannels = await db
      .select({
        userId: users.id,
        userName: users.displayName,
        userAvatar: users.photoURL,
        postCount: sql<number>`count(${feedPosts.id})`.as("postCount"),
        subscribedAt: channelSubscriptions.createdAt,
      })
      .from(channelSubscriptions)
      .innerJoin(users, eq(channelSubscriptions.channelUserId, users.id))
      .leftJoin(feedPosts, eq(users.id, feedPosts.userId))
      .where(eq(channelSubscriptions.subscriberId, userId))
      .groupBy(
        users.id,
        users.displayName,
        users.photoURL,
        channelSubscriptions.createdAt,
      )
      .orderBy(desc(channelSubscriptions.createdAt))
      .limit(20);

    res.json(subscribedChannels);
  } catch (error) {
    console.error("구독 채널 조회 실패:", error);
    res.status(500).json({ error: "구독 채널을 불러오는데 실패했습니다." });
  }
});

// 친구 채널 조회 (최근 활동한 사용자 상위 4명 - 현재 사용자 제외)
router.get("/friend-channels", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;

    const friendChannels = await db
      .select({
        userId: users.id,
        userName: users.displayName,
        userAvatar: users.photoURL,
        postCount: sql<number>`count(${feedPosts.id})`.as("postCount"),
      })
      .from(users)
      .leftJoin(feedPosts, eq(users.id, feedPosts.userId))
      .where(userId ? sql`${users.id} != ${userId}` : sql`1=1`)
      .groupBy(users.id, users.displayName, users.photoURL)
      .having(sql`count(${feedPosts.id}) > 0`)
      .orderBy(desc(sql`max(${feedPosts.createdAt})`))
      .limit(4);

    res.json(friendChannels);
  } catch (error) {
    console.error("친구 채널 조회 실패:", error);
    res.status(500).json({ error: "친구 채널을 불러오는데 실패했습니다." });
  }
});

// 게시물 검색
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const searchTerm = `%${query.trim()}%`;

    // 제목 또는 내용에서 검색 (users 테이블과 조인)
    const results = await db
      .select({
        id: feedPosts.id,
        userId: feedPosts.userId,
        userName: users.displayName,
        userAvatar: users.photoURL,
        title: feedPosts.title,
        content: feedPosts.content,
        mediaType: feedPosts.mediaType,
        mediaUrl: feedPosts.mediaUrl,
        mediaUrls: feedPosts.mediaUrls,
        thumbnailUrl: feedPosts.thumbnailUrl,
        youtubeUrl: feedPosts.youtubeUrl,
        upvotes: feedPosts.upvotes,
        downvotes: feedPosts.downvotes,
        commentCount: feedPosts.commentCount,
        viewCount: feedPosts.viewCount,
        createdAt: feedPosts.createdAt,
      })
      .from(feedPosts)
      .leftJoin(users, eq(feedPosts.userId, users.id))
      .where(
        or(
          like(feedPosts.title, searchTerm),
          like(feedPosts.content, searchTerm),
          like(users.displayName, searchTerm),
        ),
      )
      .orderBy(desc(feedPosts.createdAt))
      .limit(20);

    res.json(results);
  } catch (error) {
    console.error("검색 실패:", error);
    res.status(500).json({ error: "검색에 실패했습니다." });
  }
});

// 북마크 토글
router.post("/posts/:id/bookmark", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    const postId = parseInt(req.params.id);

    // 기존 북마크 확인
    const existing = await db
      .select()
      .from(feedPostBookmarks)
      .where(
        and(
          eq(feedPostBookmarks.postId, postId),
          eq(feedPostBookmarks.userId, userId),
        ),
      );

    if (existing.length > 0) {
      // 북마크 제거
      await db
        .delete(feedPostBookmarks)
        .where(
          and(
            eq(feedPostBookmarks.postId, postId),
            eq(feedPostBookmarks.userId, userId),
          ),
        );
      res.json({ bookmarked: false });
    } else {
      // 북마크 추가
      await db.insert(feedPostBookmarks).values({
        postId,
        userId,
      });
      res.json({ bookmarked: true });
    }
  } catch (error) {
    console.error("북마크 실패:", error);
    res.status(500).json({ error: "북마크 처리에 실패했습니다." });
  }
});

// 사용자 북마크 목록 조회
router.get("/bookmarks", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      return res.json([]);
    }

    const bookmarks = await db
      .select({
        id: feedPosts.id,
        userId: feedPosts.userId,
        userName: users.displayName,
        userAvatar: users.photoURL,
        title: feedPosts.title,
        content: feedPosts.content,
        mediaType: feedPosts.mediaType,
        mediaUrl: feedPosts.mediaUrl,
        mediaUrls: feedPosts.mediaUrls,
        thumbnailUrl: feedPosts.thumbnailUrl,
        youtubeUrl: feedPosts.youtubeUrl,
        upvotes: feedPosts.upvotes,
        downvotes: feedPosts.downvotes,
        commentCount: feedPosts.commentCount,
        viewCount: feedPosts.viewCount,
        createdAt: feedPosts.createdAt,
        bookmarkedAt: feedPostBookmarks.createdAt,
      })
      .from(feedPostBookmarks)
      .innerJoin(feedPosts, eq(feedPostBookmarks.postId, feedPosts.id))
      .leftJoin(users, eq(feedPosts.userId, users.id))
      .where(eq(feedPostBookmarks.userId, userId))
      .orderBy(desc(feedPostBookmarks.createdAt))
      .limit(20);

    res.json(bookmarks);
  } catch (error) {
    console.error("북마크 목록 조회 실패:", error);
    res.status(500).json({ error: "북마크 목록을 불러오는데 실패했습니다." });
  }
});

// 이모티콘 반응 토글
router.post("/posts/:id/reaction", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      return res.status(401).json({ error: "인증이 필요합니다." });
    }

    const postId = parseInt(req.params.id);
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: "이모티콘이 필요합니다." });
    }

    // 기존 반응 확인
    const existing = await db
      .select()
      .from(feedPostReactions)
      .where(
        and(
          eq(feedPostReactions.postId, postId),
          eq(feedPostReactions.userId, userId),
          eq(feedPostReactions.emoji, emoji),
        ),
      );

    if (existing.length > 0) {
      // 반응 제거
      await db
        .delete(feedPostReactions)
        .where(
          and(
            eq(feedPostReactions.postId, postId),
            eq(feedPostReactions.userId, userId),
            eq(feedPostReactions.emoji, emoji),
          ),
        );
      res.json({ reacted: false });
    } else {
      // 반응 추가
      await db.insert(feedPostReactions).values({
        postId,
        userId,
        emoji,
      });
      res.json({ reacted: true });
    }
  } catch (error) {
    console.error("이모티콘 반응 실패:", error);
    res.status(500).json({ error: "이모티콘 반응 처리에 실패했습니다." });
  }
});

// 게시물의 이모티콘 반응 조회
router.get("/posts/:id/reactions", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.headers["x-user-id"] as string;

    // 이모티콘별 카운트
    const reactions = await db
      .select({
        emoji: feedPostReactions.emoji,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(feedPostReactions)
      .where(eq(feedPostReactions.postId, postId))
      .groupBy(feedPostReactions.emoji);

    // 사용자가 반응한 이모티콘
    let userReactions: string[] = [];
    if (userId) {
      const userReacted = await db
        .select({ emoji: feedPostReactions.emoji })
        .from(feedPostReactions)
        .where(
          and(
            eq(feedPostReactions.postId, postId),
            eq(feedPostReactions.userId, userId),
          ),
        );
      userReactions = userReacted.map((r) => r.emoji);
    }

    res.json({ reactions, userReactions });
  } catch (error) {
    console.error("이모티콘 반응 조회 실패:", error);
    res.status(500).json({ error: "이모티콘 반응 조회에 실패했습니다." });
  }
});

// ==================== 채널 메시지 API ====================

// 채널 메시지 목록 조회
router.get("/channels/:userId/messages", async (req, res) => {
  try {
    const channelUserId = req.params.userId;
    const currentUserId = req.headers["x-user-id"] as string;

    // 채널 소유자인 경우 모든 메시지, 아닌 경우 공개 메시지 + 자신이 쓴 메시지
    const isOwner = currentUserId === channelUserId;

    let messagesQuery = db
      .select({
        id: channelMessages.id,
        channelUserId: channelMessages.channelUserId,
        senderUserId: channelMessages.senderUserId,
        message: channelMessages.message,
        imageUrl: channelMessages.imageUrl,
        isPrivate: channelMessages.isPrivate,
        createdAt: channelMessages.createdAt,
        senderName: users.displayName,
        senderAvatar: users.photoURL,
      })
      .from(channelMessages)
      .leftJoin(users, eq(channelMessages.senderUserId, users.id))
      .where(eq(channelMessages.channelUserId, channelUserId));

    // 채널 소유자가 아닌 경우 필터링
    if (!isOwner) {
      messagesQuery = messagesQuery.where(
        or(
          eq(channelMessages.isPrivate, false),
          eq(channelMessages.senderUserId, currentUserId || ""),
        ),
      ) as any;
    }

    const messages = await messagesQuery
      .orderBy(desc(channelMessages.createdAt))
      .limit(100);

    res.json(messages);
  } catch (error) {
    console.error("채널 메시지 조회 실패:", error);
    res.status(500).json({ error: "메시지를 불러오는데 실패했습니다." });
  }
});

// 채널에 메시지 작성 (이미지 업로드 지원)
const channelMessageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }
    cb(new Error("이미지 파일만 업로드 가능합니다."));
  },
}).single("image");

router.post("/channels/:userId/messages", channelMessageUpload, async (req, res) => {
  try {
    const channelUserId = req.params.userId;
    const senderUserId = req.headers["x-user-id"] as string;
    const { message, isPrivate } = req.body;

    if (!senderUserId) {
      return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    if ((!message || !message.trim()) && !req.file) {
      return res.status(400).json({ error: "메시지 내용이나 이미지가 필요합니다." });
    }

    // 이미지가 있으면 Cloudinary에 업로드
    let imageUrl: string | null = null;
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, "channel-messages");
        imageUrl = result.url;
        console.log("✅ 채널 메시지 이미지 Cloudinary 업로드 성공:", imageUrl);
      } catch (uploadError) {
        console.error("❌ 채널 메시지 이미지 업로드 실패:", uploadError);
      }
    }

    const [newMessage] = await db
      .insert(channelMessages)
      .values({
        channelUserId,
        senderUserId,
        message: (message || "").trim() || (imageUrl ? "[이미지]" : ""),
        imageUrl,
        isPrivate: isPrivate || false,
      })
      .returning();

    // 작성자 정보 포함해서 반환
    const [messageWithUser] = await db
      .select({
        id: channelMessages.id,
        channelUserId: channelMessages.channelUserId,
        senderUserId: channelMessages.senderUserId,
        message: channelMessages.message,
        imageUrl: channelMessages.imageUrl,
        isPrivate: channelMessages.isPrivate,
        createdAt: channelMessages.createdAt,
        senderName: users.displayName,
        senderAvatar: users.photoURL,
      })
      .from(channelMessages)
      .leftJoin(users, eq(channelMessages.senderUserId, users.id))
      .where(eq(channelMessages.id, newMessage.id));

    res.status(201).json(messageWithUser);
  } catch (error) {
    console.error("메시지 작성 실패:", error);
    res.status(500).json({ error: "메시지 작성에 실패했습니다." });
  }
});

// 채널 메시지 삭제 (작성자 또는 채널 소유자만)
router.delete(
  "/channels/:channelUserId/messages/:messageId",
  async (req, res) => {
    try {
      const { channelUserId, messageId } = req.params;
      const currentUserId = req.headers["x-user-id"] as string;

      if (!currentUserId) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
      }

      // 메시지 조회
      const [message] = await db
        .select()
        .from(channelMessages)
        .where(eq(channelMessages.id, parseInt(messageId)))
        .limit(1);

      if (!message) {
        return res.status(404).json({ error: "메시지를 찾을 수 없습니다." });
      }

      // 권한 확인 (작성자 또는 채널 소유자)
      if (
        message.senderUserId !== currentUserId &&
        message.channelUserId !== currentUserId
      ) {
        return res.status(403).json({ error: "권한이 없습니다." });
      }

      await db
        .delete(channelMessages)
        .where(eq(channelMessages.id, parseInt(messageId)));

      res.json({ message: "메시지가 삭제되었습니다." });
    } catch (error) {
      console.error("메시지 삭제 실패:", error);
      res.status(500).json({ error: "메시지 삭제에 실패했습니다." });
    }
  },
);

// ==================== 구독 API ====================

// 채널 구독/구독취소 토글
router.post("/channels/:channelUserId/subscribe", async (req, res) => {
  try {
    const subscriberId = req.headers["x-user-id"] as string;
    const channelUserId = req.params.channelUserId;

    if (!subscriberId) {
      return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    if (subscriberId === channelUserId) {
      return res.status(400).json({ error: "자신을 구독할 수 없습니다." });
    }

    // 기존 구독 확인
    const existing = await db
      .select()
      .from(channelSubscriptions)
      .where(
        and(
          eq(channelSubscriptions.subscriberId, subscriberId),
          eq(channelSubscriptions.channelUserId, channelUserId),
        ),
      );

    if (existing.length > 0) {
      // 구독 취소
      await db
        .delete(channelSubscriptions)
        .where(
          and(
            eq(channelSubscriptions.subscriberId, subscriberId),
            eq(channelSubscriptions.channelUserId, channelUserId),
          ),
        );
      res.json({ subscribed: false, message: "구독이 취소되었습니다." });
    } else {
      // 구독 추가
      await db.insert(channelSubscriptions).values({
        subscriberId,
        channelUserId,
      });
      res.json({ subscribed: true, message: "구독이 완료되었습니다." });
    }
  } catch (error) {
    console.error("구독 처리 실패:", error);
    res.status(500).json({ error: "구독 처리에 실패했습니다." });
  }
});

// 채널 구독자 수 조회
router.get("/channels/:channelUserId/subscribers/count", async (req, res) => {
  try {
    const channelUserId = req.params.channelUserId;

    const result = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(channelSubscriptions)
      .where(eq(channelSubscriptions.channelUserId, channelUserId));

    res.json({ count: result[0]?.count || 0 });
  } catch (error) {
    console.error("구독자 수 조회 실패:", error);
    res.status(500).json({ error: "구독자 수 조회에 실패했습니다." });
  }
});

// 구독 상태 확인
router.get("/channels/:channelUserId/subscription-status", async (req, res) => {
  try {
    const subscriberId = req.headers["x-user-id"] as string;
    const channelUserId = req.params.channelUserId;

    if (!subscriberId) {
      return res.json({ subscribed: false });
    }

    const existing = await db
      .select()
      .from(channelSubscriptions)
      .where(
        and(
          eq(channelSubscriptions.subscriberId, subscriberId),
          eq(channelSubscriptions.channelUserId, channelUserId),
        ),
      );

    res.json({ subscribed: existing.length > 0 });
  } catch (error) {
    console.error("구독 상태 확인 실패:", error);
    res.status(500).json({ error: "구독 상태 확인에 실패했습니다." });
  }
});

// ==================== 채널 정보 수정 API ====================

// 사용자 프로필 업데이트 (채널 정보)
router.put("/users/:userId/profile", async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.headers["x-user-id"] as string;

    if (!currentUserId || currentUserId !== userId) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    const { displayName, bio } = req.body;

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "업데이트할 내용이 없습니다." });
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    res.json(updatedUser);
  } catch (error) {
    console.error("프로필 업데이트 실패:", error);
    res.status(500).json({ error: "프로필 업데이트에 실패했습니다." });
  }
});

// ==================== 게시물 신고 API ====================

// 게시물 신고
router.post("/posts/:postId/report", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.headers["x-user-id"] as string;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "신고 사유를 입력해주세요." });
    }

    // 이미 신고했는지 확인
    const existingReport = await db
      .select()
      .from(feedPostReports)
      .where(
        and(
          eq(feedPostReports.postId, postId),
          eq(feedPostReports.userId, userId)
        )
      )
      .limit(1);

    if (existingReport.length > 0) {
      return res.status(400).json({ error: "이미 신고한 게시물입니다." });
    }

    // 신고 추가
    await db.insert(feedPostReports).values({
      postId,
      userId,
      reason: reason.trim(),
    });

    // 신고 횟수 증가
    await db
      .update(feedPosts)
      .set({
        reportCount: sql`${feedPosts.reportCount} + 1`,
      })
      .where(eq(feedPosts.id, postId));

    // 현재 신고 횟수 조회
    const [post] = await db
      .select({ reportCount: feedPosts.reportCount })
      .from(feedPosts)
      .where(eq(feedPosts.id, postId))
      .limit(1);

    res.json({
      success: true,
      message: "신고가 접수되었습니다.",
      reportCount: post?.reportCount || 0,
    });
  } catch (error) {
    console.error("게시물 신고 실패:", error);
    res.status(500).json({ error: "게시물 신고에 실패했습니다." });
  }
});

// 게시물 신고 횟수 조회
router.get("/posts/:postId/report-count", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);

    const [post] = await db
      .select({ reportCount: feedPosts.reportCount })
      .from(feedPosts)
      .where(eq(feedPosts.id, postId))
      .limit(1);

    res.json({ reportCount: post?.reportCount || 0 });
  } catch (error) {
    console.error("신고 횟수 조회 실패:", error);
    res.status(500).json({ error: "신고 횟수 조회에 실패했습니다." });
  }
});

// 사용자의 신고 여부 확인
router.get("/posts/:postId/report-status", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      return res.json({ hasReported: false });
    }

    const existingReport = await db
      .select()
      .from(feedPostReports)
      .where(
        and(
          eq(feedPostReports.postId, postId),
          eq(feedPostReports.userId, userId)
        )
      )
      .limit(1);

    res.json({ hasReported: existingReport.length > 0 });
  } catch (error) {
    console.error("신고 상태 조회 실패:", error);
    res.status(500).json({ error: "신고 상태 조회에 실패했습니다." });
  }
});

export default router;
