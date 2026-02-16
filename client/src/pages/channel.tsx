import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import axios from "axios";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface ChannelInfo {
  userId: string;
  userName: string;
  userAvatar: string | null;
  postCount: number;
  followerCount: number;
  description: string;
}

interface FeedPost {
  id: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  title: string;
  content: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  mediaUrls: string[] | null; // 다중 이미지 URL 배열
  thumbnailUrl: string | null;
  youtubeUrl: string | null;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
}

interface ChannelPageProps {
  userId?: string;
}

const ChannelPage: React.FC<ChannelPageProps> = ({ userId: propUserId }) => {
  const [, setLocation] = useLocation();
  const userId = propUserId;
  const { user } = useAuth();
  const { toast } = useToast();

  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // 게시물 작성 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostMedia, setNewPostMedia] = useState<File[]>([]); // 다중 파일 배열로 변경
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]); // 다중 미리보기 배열
  const [newPostYoutubeUrl, setNewPostYoutubeUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 게시물 수정 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editYoutubeUrl, setEditYoutubeUrl] = useState("");
  const [editMedia, setEditMedia] = useState<File[]>([]); // 다중 파일 배열로 변경
  const [editMediaPreviews, setEditMediaPreviews] = useState<string[]>([]); // 다중 미리보기 배열

  // 게시물 삭제 상태
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 채널 메시지 상태
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isPrivateMessage, setIsPrivateMessage] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  // 정보 수정 상태
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);

  // 이미지 라이트박스 상태
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  useEffect(() => {
    loadChannelInfo();
    loadPosts();
    loadMessages();
    if (user && userId) {
      loadSubscriptionStatus();
    }
  }, [userId, user]);

  const loadChannelInfo = async () => {
    try {
      // 사용자 정보 가져오기
      const userResponse = await axios.get(`/api/users/${userId}`);
      const userData = userResponse.data;

      // 구독자 수 가져오기
      const subscriberResponse = await axios.get(
        `/api/feed/channels/${userId}/subscribers/count`,
      );
      setSubscriberCount(subscriberResponse.data.count);

      setChannelInfo({
        userId: userId || "",
        userName: userData.displayName || "사용자",
        userAvatar: userData.photoURL || null,
        postCount: 0, // loadPosts에서 업데이트
        followerCount: subscriberResponse.data.count,
        description:
          userData.bio || "안녕하세요! 다양한 콘텐츠를 공유하는 채널입니다.",
      });
      setIsLoading(false);
    } catch (error) {
      console.error("채널 정보 로드 실패:", error);
      // 기본값으로 설정
      setChannelInfo({
        userId: userId || "",
        userName: "사용자",
        userAvatar: null,
        postCount: 0,
        followerCount: 0,
        description: "안녕하세요!",
      });
      setIsLoading(false);
    }
  };

  const loadSubscriptionStatus = async () => {
    if (!user || !userId) return;

    try {
      const response = await axios.get(
        `/api/feed/channels/${userId}/subscription-status`,
        {
          headers: {
            "X-User-ID": user.uid,
          },
        },
      );
      setIsSubscribed(response.data.subscribed);
    } catch (error) {
      console.error("구독 상태 로드 실패:", error);
    }
  };

  const handleSubscribeToggle = async () => {
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "구독하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.post(
        `/api/feed/channels/${userId}/subscribe`,
        {},
        {
          headers: {
            "X-User-ID": user.uid,
          },
        },
      );

      setIsSubscribed(response.data.subscribed);
      
      // 구독자 수 업데이트
      if (response.data.subscribed) {
        setSubscriberCount((prev) => prev + 1);
      } else {
        setSubscriberCount((prev) => Math.max(0, prev - 1));
      }

      toast({
        title: response.data.subscribed ? "구독 완료" : "구독 취소",
        description: response.data.message,
      });
    } catch (error) {
      console.error("구독 처리 실패:", error);
      toast({
        title: "오류",
        description: "구독 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const loadPosts = async () => {
    try {
      setIsLoadingPosts(true);
      const response = await axios.get(
        `/api/feed/posts?userId=${userId}&limit=100`,
      );
      setPosts(response.data.posts);

      // 포스트 수 업데이트
      setChannelInfo((prev) =>
        prev ? { ...prev, postCount: response.data.posts.length } : null,
      );

      setIsLoadingPosts(false);
    } catch (error) {
      console.error("게시물 로드 실패:", error);
      setPosts([]);
      setIsLoadingPosts(false);
    }
  };

  const loadMessages = async () => {
    if (!userId) return;

    try {
      const response = await axios.get(
        `/api/feed/channels/${userId}/messages`,
        {
          headers: user ? { "X-User-ID": user.uid } : {},
        },
      );
      setMessages(response.data);
    } catch (error) {
      console.error("메시지 로드 실패:", error);
      setMessages([]);
    }
  };

  // 이미지 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "파일 크기 초과", description: "10MB 이하의 이미지만 업로드 가능합니다.", variant: "destructive" });
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || !user) return;

    setIsSendingMessage(true);
    try {
      // FormData로 전송 (이미지 포함 가능)
      const formData = new FormData();
      formData.append("message", newMessage);
      formData.append("isPrivate", String(isPrivateMessage));
      if (selectedImage) {
        formData.append("image", selectedImage);
      }

      const response = await axios.post(
        `/api/feed/channels/${userId}/messages`,
        formData,
        {
          headers: {
            "X-User-ID": user.uid,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setMessages((prev) => [response.data, ...prev]);
      setNewMessage("");
      setIsPrivateMessage(false);
      handleRemoveImage();

      toast({
        title: "메시지 전송 완료",
        description: "메시지가 성공적으로 전송되었습니다.",
      });
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      toast({
        title: "전송 실패",
        description: "메시지 전송에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!user) return;

    try {
      await axios.delete(`/api/feed/channels/${userId}/messages/${messageId}`, {
        headers: { "X-User-ID": user.uid },
      });

      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      toast({
        title: "메시지 삭제 완료",
        description: "메시지가 삭제되었습니다.",
      });
    } catch (error) {
      console.error("메시지 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "메시지 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleOpenEditInfoModal = () => {
    if (!channelInfo) return;
    setEditDisplayName(channelInfo.userName);
    setEditBio(channelInfo.description);
    setShowEditInfoModal(true);
  };

  const handleUpdateChannelInfo = async () => {
    if (!user || !userId) return;

    setIsUpdatingInfo(true);
    try {
      await axios.put(
        `/api/feed/users/${userId}/profile`,
        {
          displayName: editDisplayName,
          bio: editBio,
        },
        {
          headers: { "X-User-ID": user.uid },
        },
      );

      toast({
        title: "정보 업데이트 완료",
        description: "채널 정보가 성공적으로 업데이트되었습니다.",
      });

      setShowEditInfoModal(false);
      loadChannelInfo();
    } catch (error) {
      console.error("정보 업데이트 실패:", error);
      toast({
        title: "업데이트 실패",
        description: "정보 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingInfo(false);
    }
  };


  // 게시물 삭제 확인
  const handleDeleteClick = (postId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPostToDelete(postId);
    setShowDeleteDialog(true);
  };

  // 게시물 삭제 실행
  const handleDeletePost = async () => {
    if (!postToDelete || !user) return;

    setIsDeleting(true);
    try {
      await axios.delete(`/api/feed/posts/${postToDelete}`, {
        headers: {
          "X-User-ID": user.uid,
          "X-User-Type": user.userType || "",
        },
      });

      toast({
        title: "게시물 삭제 완료",
        description: "게시물이 성공적으로 삭제되었습니다.",
      });

      // 게시물 목록 새로고침
      loadPosts();

      // 다이얼로그 닫기
      setShowDeleteDialog(false);
      setPostToDelete(null);
    } catch (error) {
      console.error("게시물 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "게시물 삭제에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // 미디어 파일 선택 핸들러 (다중 파일 지원)
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 최대 10개 파일 제한
    if (files.length > 10) {
      toast({
        title: "파일 개수 초과",
        description: "최대 10개의 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    // 각 파일 크기 체크 (50MB)
    const oversizedFiles = files.filter((file) => file.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "파일 크기 초과",
        description: "각 파일 크기는 50MB를 초과할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setNewPostMedia(files);

    // 미리보기 생성
    const previews: string[] = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        if (previews.length === files.length) {
          setMediaPreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 유튜브 비디오 ID 추출
  const extractYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  // 게시물 수정 모달 열기
  const handleOpenEditModal = (post: FeedPost) => {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditContent(post.content || "");
    setEditYoutubeUrl(post.youtubeUrl || "");
    // 기존 이미지들을 미리보기로 설정
    const existingImages =
      post.mediaUrls || (post.mediaUrl ? [post.mediaUrl] : []);
    setEditMediaPreviews(existingImages);
    setEditMedia([]);
    setShowEditModal(true);
  };

  // 수정용 미디어 파일 선택 (다중 파일 지원)
  const handleEditMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 최대 10개 파일 제한
    if (files.length > 10) {
      toast({
        title: "파일 개수 초과",
        description: "최대 10개의 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    // 각 파일 크기 체크 (50MB)
    const oversizedFiles = files.filter((file) => file.size > 50 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast({
        title: "파일 크기 초과",
        description: "각 파일 크기는 50MB를 초과할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setEditMedia(files);

    // 미리보기 생성
    const previews: string[] = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        if (previews.length === files.length) {
          setEditMediaPreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 게시물 수정 제출
  const handleEditPost = async () => {
    if (!editTitle.trim()) {
      toast({
        title: "제목 필요",
        description: "게시물 제목을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!editingPost) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", editTitle);
      formData.append("content", editContent);

      if (editYoutubeUrl.trim()) {
        formData.append("youtubeUrl", editYoutubeUrl);
        formData.append("mediaType", "youtube");
      }

      // 다중 파일 추가
      if (editMedia.length > 0) {
        editMedia.forEach((file) => {
          formData.append("media", file);
        });
        const hasVideo = editMedia.some((file) =>
          file.type.startsWith("video"),
        );
        formData.append("mediaType", hasVideo ? "video" : "image");
      }

      await axios.put(`/api/feed/posts/${editingPost.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-User-ID": user?.uid || "",
          "X-User-Type": user?.userType || "",
        },
      });

      toast({
        title: "게시물 수정 완료",
        description: "게시물이 성공적으로 수정되었습니다.",
      });

      setShowEditModal(false);
      setEditingPost(null);
      loadPosts();
    } catch (error: any) {
      console.error("게시물 수정 실패:", error);
      toast({
        title: "수정 실패",
        description:
          error.response?.data?.error || "게시물 수정에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 게시물 작성 핸들러
  const handleCreatePost = async () => {
    if (!newPostTitle.trim()) {
      toast({
        title: "제목 필요",
        description: "게시물 제목을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", newPostTitle);
      formData.append("content", newPostContent);

      if (newPostYoutubeUrl.trim()) {
        formData.append("youtubeUrl", newPostYoutubeUrl);
        formData.append("mediaType", "youtube");
      }

      // 다중 파일 추가
      if (newPostMedia.length > 0) {
        newPostMedia.forEach((file) => {
          formData.append("media", file);
        });
        const hasVideo = newPostMedia.some((file) =>
          file.type.startsWith("video"),
        );
        formData.append("mediaType", hasVideo ? "video" : "image");
      }

      await axios.post("/api/feed/posts", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-User-ID": user?.uid || "",
        },
      });

      toast({
        title: "게시물 작성 완료",
        description: "게시물이 성공적으로 작성되었습니다.",
      });

      // 초기화
      setShowCreateModal(false);
      setNewPostTitle("");
      setNewPostContent("");
      setNewPostMedia([]);
      setMediaPreviews([]);
      setNewPostYoutubeUrl("");

      // 게시물 목록 새로고침
      loadPosts();
    } catch (error) {
      console.error("게시물 작성 실패:", error);
      toast({
        title: "작성 실패",
        description: "게시물 작성에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#030303]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!channelInfo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#030303]">
        <i className="fas fa-exclamation-circle text-6xl text-gray-600 mb-4"></i>
        <p className="text-gray-400 mb-4">채널을 찾을 수 없습니다.</p>
        <Button onClick={() => setLocation("/discord")}>돌아가기</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#030303] overflow-y-auto transition-colors">
      {/* 헤더 */}
      <div className="h-12 border-b border-gray-700 flex items-center px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/discord")}
          className="text-gray-400 hover:text-white"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          뒤로
        </Button>
        <h2 className="text-lg font-semibold text-white ml-4">내 채널</h2>
      </div>

      <div className="max-w-4xl mx-auto w-full p-6">
        {/* 채널 헤더 */}
        <Card className="bg-gray-50 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B] p-6 mb-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24 ring-4 ring-blue-600">
              <AvatarImage src={channelInfo.userAvatar || undefined} />
              <AvatarFallback className="bg-blue-600 text-white text-2xl">
                {channelInfo.userName[0] || "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-2">
                {channelInfo.userName}
              </h1>

              <div className="flex items-center gap-6 text-sm text-gray-400 mb-4">
                <span>
                  <i className="fas fa-file-alt mr-2"></i>
                  게시물 {channelInfo.postCount}
                </span>
                <span>
                  <i className="fas fa-bell mr-2"></i>
                  구독자 {subscriberCount.toLocaleString()}
                </span>
              </div>

              <p className="text-gray-300 mb-4">{channelInfo.description}</p>

              <div className="flex gap-3">
                {user && channelInfo.userId !== user.uid && (
                  <Button
                    onClick={handleSubscribeToggle}
                    className={`px-6 ${
                      isSubscribed
                        ? "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isSubscribed ? (
                      <>
                        <i className="fas fa-bell-slash mr-2"></i>
                        구독중
                      </>
                    ) : (
                      <>
                        <i className="fas fa-bell mr-2"></i>
                        구독
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* 탭 */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="bg-gray-100 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B] w-full">
            <TabsTrigger value="posts" className="flex-1">
              <i className="fas fa-th mr-2"></i>
              게시물
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex-1">
              <i className="fas fa-comments mr-2"></i>
              메시지
              {messages.length > 0 && (
                <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {messages.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="about" className="flex-1">
              <i className="fas fa-info-circle mr-2"></i>
              정보
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-6">
            {/* 게시물 목록 */}
            {isLoadingPosts ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <i className="fas fa-image text-6xl mb-4"></i>
                <p>아직 게시물이 없습니다.</p>
                {user && channelInfo && user.uid === channelInfo.userId && (
                  <p className="text-sm mt-2">첫 게시물을 작성해보세요!</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {posts.map((post) => {
                  // 이미지 배열 준비 (mediaUrls 우선, 없으면 mediaUrl 사용)
                  const imageUrls =
                    post.mediaUrls && post.mediaUrls.length > 0
                      ? post.mediaUrls
                      : post.mediaUrl
                        ? [post.mediaUrl]
                        : [];
                  const hasMultipleImages = imageUrls.length > 1;

                  return (
                    <Card
                      key={post.id}
                      className="bg-gray-50 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B] overflow-hidden cursor-pointer hover:opacity-80 transition-opacity aspect-square"
                      onClick={() => setLocation(`/discord?post=${post.id}`)}
                    >
                      {imageUrls.length > 0 || post.youtubeUrl ? (
                        <div className="relative w-full h-full">
                          {post.mediaType === "image" &&
                          imageUrls.length > 0 ? (
                            <div
                              className="relative w-full h-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImages(imageUrls);
                                setLightboxInitialIndex(0);
                                setLightboxOpen(true);
                              }}
                            >
                              <img
                                src={imageUrls[0]}
                                alt={post.title}
                                className="w-full h-full object-cover"
                              />
                              {/* 다중 이미지 인디케이터 */}
                              {hasMultipleImages && (
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                  <i className="fas fa-images"></i>
                                  <span>{imageUrls.length}</span>
                                </div>
                              )}
                            </div>
                          ) : post.mediaType === "video" &&
                            imageUrls.length > 0 ? (
                            <video
                              src={imageUrls[0]}
                              className="w-full h-full object-cover"
                            />
                          ) : post.youtubeUrl &&
                            extractYoutubeVideoId(post.youtubeUrl) ? (
                            <div className="relative w-full h-full">
                              <iframe
                                src={`https://www.youtube.com/embed/${extractYoutubeVideoId(post.youtubeUrl)}`}
                                className="absolute inset-0 w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ pointerEvents: "none" }}
                              />
                            </div>
                          ) : null}
                          {/* 오버레이 정보 */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                            <div className="text-white text-center p-2">
                              <div className="flex items-center justify-center gap-4 text-sm mb-3">
                                <span>
                                  <i className="fas fa-arrow-up mr-1"></i>
                                  {post.upvotes - post.downvotes}
                                </span>
                                <span>
                                  <i className="fas fa-comment mr-1"></i>
                                  {post.commentCount}
                                </span>
                              </div>
                              {/* 수정/삭제 버튼 - 본인 게시물 또는 관리자에게 표시 */}
                              {user &&
                                channelInfo &&
                                (user.uid === channelInfo.userId || user.userType === 'admin') && (
                                  <div className="flex gap-2 justify-center">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs border-white text-black hover:bg-white hover:text-gray-900"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditModal(post);
                                      }}
                                    >
                                      <i className="fas fa-edit mr-1"></i>
                                      수정
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="text-xs"
                                      onClick={(e) =>
                                        handleDeleteClick(post.id, e)
                                      }
                                    >
                                      <i className="fas fa-trash-alt mr-1"></i>
                                      삭제
                                    </Button>
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 p-4">
                          <div className="text-center">
                            <p className="text-white text-sm font-semibold line-clamp-3">
                              {post.title}
                            </p>
                            {post.content && (
                              <p className="text-gray-400 text-xs mt-2 line-clamp-2">
                                {post.content}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* 메시지 탭 */}
          <TabsContent value="messages" className="mt-6">
            <Card className="bg-gray-50 dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B]">
              {/* 메시지 입력 */}
              {user && (
                <div className="p-4 border-b border-gray-700">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="메시지를 입력하세요..."
                    className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white mb-3"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPrivateMessage}
                        onChange={(e) => setIsPrivateMessage(e.target.checked)}
                        className="mr-2"
                      />
                      <i className="fas fa-lock mr-1"></i>
                      채널 소유자만 볼 수 있는 비공개 메시지
                    </label>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isSendingMessage}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isSendingMessage ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          전송 중...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-paper-plane mr-2"></i>
                          전송
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* 메시지 목록 */}
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <i className="fas fa-comments text-6xl mb-4"></i>
                    <p>아직 메시지가 없습니다.</p>
                    {user && (
                      <p className="text-sm mt-2">첫 메시지를 남겨보세요!</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <Card
                        key={message.id}
                        className={`bg-gray-100 dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] p-4 ${message.isPrivate ? "border-l-4 border-l-yellow-500" : ""}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={message.senderAvatar || undefined}
                              />
                              <AvatarFallback className="bg-blue-600 text-white text-xs">
                                {message.senderName?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-white font-semibold text-sm">
                                {message.senderName || "익명"}
                                {message.isPrivate && (
                                  <i className="fas fa-lock text-yellow-500 ml-2 text-xs"></i>
                                )}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {formatDistanceToNow(
                                  new Date(message.createdAt),
                                  {
                                    addSuffix: true,
                                    locale: ko,
                                  },
                                )}
                              </p>
                            </div>
                          </div>
                          {user &&
                            (user.uid === message.senderUserId ||
                              user.uid === userId) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                onClick={() => handleDeleteMessage(message.id)}
                              >
                                <i className="fas fa-trash-alt"></i>
                              </Button>
                            )}
                        </div>
                        {message.imageUrl && (
                          <div className="mt-2 mb-1">
                            <img
                              src={message.imageUrl}
                              alt="첨부 이미지"
                              className="max-w-xs max-h-60 rounded-lg object-cover cursor-pointer hover:opacity-90 transition"
                              onClick={() => window.open(message.imageUrl, '_blank')}
                            />
                          </div>
                        )}
                        {message.message && message.message !== '[이미지]' && (
                          <p className="text-gray-300 text-sm whitespace-pre-wrap">
                            {message.message}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* 정보 탭 */}
          <TabsContent value="about" className="mt-6">
            <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">채널 정보</h3>
                {user && user.uid === userId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={handleOpenEditInfoModal}
                  >
                    <i className="fas fa-edit mr-2"></i>
                    수정
                  </Button>
                )}
              </div>
              <div className="space-y-3 text-gray-300">
                <div>
                  <span className="text-gray-500">채널 ID:</span>
                  <p className="font-mono text-sm mt-1">{channelInfo.userId}</p>
                </div>
                <div>
                  <span className="text-gray-500">채널 이름:</span>
                  <p className="mt-1">{channelInfo.userName}</p>
                </div>
                <div>
                  <span className="text-gray-500">설명:</span>
                  <p className="mt-1 whitespace-pre-wrap">
                    {channelInfo.description}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">게시물 수:</span>
                  <p className="mt-1">{channelInfo.postCount}개</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 플로팅 작성 버튼 */}
      {user && channelInfo && user.uid === channelInfo.userId && (
        <Button
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-2xl bg-gradient-to-br from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 z-50 border-2 border-black"
          onClick={() => setShowCreateModal(true)}
        >
          <i className="fas fa-plus text-lg text-white"></i>
        </Button>
      )}

      {/* 게시물 작성 모달 */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B] text-gray-900 dark:text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              새 게시물 작성
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 제목 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                제목 *
              </label>
              <Input
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="게시물 제목을 입력하세요"
                className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white"
                maxLength={200}
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                내용
              </label>
              <Textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="게시물 내용을 입력하세요 (선택사항)"
                className="bg-gray-700 border-gray-600 text-white min-h-[120px]"
                maxLength={2000}
              />
            </div>

            {/* 유튜브 URL */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                <i className="fab fa-youtube text-red-500 mr-2"></i>
                유튜브 링크 (선택사항)
              </label>
              <Input
                value={newPostYoutubeUrl}
                onChange={(e) => setNewPostYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                유튜브 동영상 URL을 입력하면 게시물에 임베드됩니다
              </p>
            </div>

            {/* 미디어 업로드 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                이미지 또는 동영상 (최대 10개 다중선택)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                최대 50MB, 지원 형식: JPG, PNG, GIF, WEBP, MP4, MOV, WEBM
              </p>

              {/* 드래그 앤 드롭 영역 */}
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-700/50"
                onClick={() => document.getElementById("media-upload")?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("border-blue-500");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-blue-500");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-blue-500");
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const fakeEvent = {
                      target: { files: [file] },
                    } as any;
                    handleMediaSelect(fakeEvent);
                  }
                }}
              >
                <i className="fas fa-cloud-upload-alt text-4xl text-gray-500 mb-3"></i>
                <p className="text-gray-400 mb-1">
                  클릭하거나 파일을 드래그하여 업로드
                </p>
                <Button
                  variant="outline"
                  className="mt-2 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById("media-upload")?.click();
                  }}
                >
                  <i className="fas fa-image mr-2"></i>
                  파일 선택
                </Button>
              </div>

              <input
                id="media-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaSelect}
                className="hidden"
              />

              {newPostMedia.length > 0 && (
                <div className="mt-2 text-sm text-gray-400">
                  <p className="mb-2">
                    <i className="fas fa-images mr-2"></i>
                    {newPostMedia.length}개 파일 선택됨
                  </p>
                  <div className="space-y-1">
                    {newPostMedia.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs"
                      >
                        <i className="fas fa-file-alt"></i>
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-gray-600">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 미디어 미리보기 (다중 이미지 그리드) */}
              {mediaPreviews.length > 0 && (
                <div className="mt-3 relative">
                  <div className="grid grid-cols-2 gap-2">
                    {mediaPreviews.map((preview, idx) => (
                      <div key={idx} className="relative group">
                        {newPostMedia[idx]?.type.startsWith("video") ? (
                          <video
                            src={preview}
                            className="w-full h-48 object-cover rounded-lg"
                            controls
                          />
                        ) : (
                          <img
                            src={preview}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        )}
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          {idx + 1}/{mediaPreviews.length}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => {
                      setNewPostMedia([]);
                      setMediaPreviews([]);
                    }}
                  >
                    <i className="fas fa-times mr-2"></i>
                    모든 파일 제거
                  </Button>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPostTitle("");
                  setNewPostContent("");
                  setNewPostMedia([]);
                  setMediaPreviews([]);
                }}
                disabled={isSubmitting}
              >
                <i className="fas fa-times mr-2"></i>
                취소
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleCreatePost}
                disabled={isSubmitting || !newPostTitle.trim()}
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    작성 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane mr-2"></i>
                    게시
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 게시물 삭제 확인 다이얼로그 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">게시물 삭제</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-gray-300 mb-4">이 게시물을 삭제하시겠습니까?</p>
            <p className="text-sm text-gray-500">
              삭제된 게시물은 복구할 수 없습니다.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-gray-600 bg-gray-700 hover:bg-gray-600 text-white"
              onClick={() => {
                setShowDeleteDialog(false);
                setPostToDelete(null);
              }}
              disabled={isDeleting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDeletePost}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  삭제 중...
                </>
              ) : (
                <>
                  <i className="fas fa-trash-alt mr-2"></i>
                  삭제
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 게시물 수정 모달 */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-[#1A1A1B] text-gray-900 dark:text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">게시물 수정</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 제목 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                제목 *
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="게시물 제목을 입력하세요"
                className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white"
                maxLength={200}
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                내용
              </label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="게시물 내용을 입력하세요 (선택사항)"
                className="bg-gray-700 border-gray-600 text-white min-h-[120px]"
                maxLength={2000}
              />
            </div>

            {/* 유튜브 URL */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                <i className="fab fa-youtube text-red-500 mr-2"></i>
                유튜브 링크 (선택사항)
              </label>
              <Input
                value={editYoutubeUrl}
                onChange={(e) => setEditYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                유튜브 동영상 URL을 입력하면 게시물에 임베드됩니다
              </p>
            </div>

            {/* 미디어 업로드 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                이미지 또는 동영상 (최대 10개 다중선택)
              </label>
              <input
                id="edit-media-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleEditMediaSelect}
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                className="w-full border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                onClick={() =>
                  document.getElementById("edit-media-upload")?.click()
                }
              >
                <i className="fas fa-upload mr-2"></i>
                {editMedia.length > 0 ? "파일 다시 선택" : "새 파일 선택"}
              </Button>

              {editMedia.length > 0 && (
                <div className="mt-2 text-sm text-gray-400">
                  <p className="mb-2">
                    <i className="fas fa-images mr-2"></i>
                    {editMedia.length}개 새 파일 선택됨
                  </p>
                  <div className="space-y-1">
                    {editMedia.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs"
                      >
                        <i className="fas fa-file-alt"></i>
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-gray-600">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 미디어 미리보기 (다중 이미지 그리드) */}
              {editMediaPreviews.length > 0 && (
                <div className="mt-3 relative">
                  <p className="text-sm text-gray-400 mb-2">
                    {editMedia.length > 0
                      ? "새로 선택한 이미지:"
                      : "기존 이미지:"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {editMediaPreviews.map((preview, idx) => (
                      <div key={idx} className="relative group">
                        {preview.match(/\.(mp4|webm|mov)$/i) ||
                        editMedia[idx]?.type.startsWith("video") ? (
                          <video
                            src={preview}
                            className="w-full h-48 object-cover rounded-lg"
                            controls
                          />
                        ) : preview.includes("youtube") ? (
                          <div className="w-full h-48 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm">
                            유튜브 비디오
                          </div>
                        ) : (
                          <img
                            src={preview}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        )}
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          {idx + 1}/{editMediaPreviews.length}
                        </div>
                      </div>
                    ))}
                  </div>
                  {editMedia.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => {
                        setEditMedia([]);
                        // 기존 이미지로 복원
                        const existingImages =
                          editingPost?.mediaUrls ||
                          (editingPost?.mediaUrl ? [editingPost.mediaUrl] : []);
                        setEditMediaPreviews(existingImages);
                      }}
                    >
                      <i className="fas fa-times mr-2"></i>새 파일 선택 취소
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                onClick={() => setShowEditModal(false)}
                disabled={isSubmitting}
              >
                <i className="fas fa-times mr-2"></i>
                취소
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleEditPost}
                disabled={isSubmitting || !editTitle.trim()}
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    수정 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    저장
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 채널 정보 수정 모달 */}
      <Dialog open={showEditInfoModal} onOpenChange={setShowEditInfoModal}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              채널 정보 수정
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* 채널 이름 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                채널 이름
              </label>
              <Input
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="채널 이름을 입력하세요"
                className="bg-white dark:bg-[#1A1A1B] border-gray-300 dark:border-[#272729] text-gray-900 dark:text-white"
                maxLength={50}
              />
            </div>

            {/* 채널 설명 */}
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                채널 설명
              </label>
              <Textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="채널 설명을 입력하세요"
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white min-h-[100px]"
                maxLength={500}
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                onClick={() => setShowEditInfoModal(false)}
                disabled={isUpdatingInfo}
              >
                <i className="fas fa-times mr-2"></i>
                취소
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleUpdateChannelInfo}
                disabled={isUpdatingInfo || !editDisplayName.trim()}
              >
                {isUpdatingInfo ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    저장 중...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    저장
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 이미지 라이트박스 */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxInitialIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};

export default ChannelPage;
