import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Star, 
  Edit3, 
  Trash2, 
  MessageSquare, 
  Calendar,
  Package,
  Save,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface Review {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  order_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at?: string;
}

export default function MyReviewsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState("");

  // 내가 쓴 리뷰 조회 (임시 더미 데이터)
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["my-reviews", user?.uid || user?.email],
    queryFn: async () => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000)); // 로딩 시뮬레이션
      
      return [
        {
          id: "review_001",
          product_id: "1",
          product_name: "미라이 - VTuber 아바타",
          product_image: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=300",
          order_id: "order_001",
          rating: 5,
          comment: "정말 퀄리티가 높아요! 표정 변화와 움직임이 자연스럽고 음성 합성도 완벽합니다. 스트리밍에 사용하니 시청자 반응이 너무 좋아요!",
          created_at: "2024-01-15T10:30:00Z"
        },
        {
          id: "review_002", 
          product_id: "3",
          product_name: "사쿠라 - 일본풍 VTuber",
          product_image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300",
          order_id: "order_003",
          rating: 4,
          comment: "일본 전통 의상이 정말 예뻐요. 애니메이션도 부드럽고 목소리도 좋습니다.",
          created_at: "2024-01-05T09:15:00Z"
        },
        {
          id: "review_003",
          product_id: "2", 
          product_name: "커스텀 AI 아바타 제작",
          product_image: "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=300",
          order_id: "order_001",
          rating: 5,
          comment: "완전 맞춤 제작이라 그런지 정말 마음에 들어요. 디테일도 완벽하고 제작 기간도 빨랐습니다!",
          created_at: "2024-01-15T10:30:00Z",
          updated_at: "2024-01-16T14:20:00Z"
        }
      ] as Review[];
    },
    enabled: !!user,
  });

  // 리뷰 수정 뮤테이션
  const updateReviewMutation = useMutation({
    mutationFn: async ({ reviewId, rating, comment }: { reviewId: string; rating: number; comment: string }) => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { reviewId, rating, comment };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
      setEditingReview(null);
      toast({
        title: "리뷰가 수정되었습니다",
        description: "리뷰 내용이 성공적으로 업데이트되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "리뷰 수정 실패",
        description: "리뷰 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  // 리뷰 삭제 뮤테이션
  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000));
      return reviewId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
      toast({
        title: "리뷰가 삭제되었습니다",
        description: "리뷰가 성공적으로 삭제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "리뷰 삭제 실패",
        description: "리뷰 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating 
                ? "fill-yellow-400 text-yellow-400" 
                : "text-gray-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
            onClick={interactive && onRatingChange ? () => onRatingChange(star) : undefined}
          />
        ))}
      </div>
    );
  };

  const handleEditReview = (review: Review) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment);
  };

  const handleSaveEdit = () => {
    if (editingReview && editRating > 0 && editComment.trim()) {
      updateReviewMutation.mutate({
        reviewId: editingReview.id,
        rating: editRating,
        comment: editComment.trim()
      });
    }
  };

  const handleDeleteReview = (reviewId: string) => {
    if (confirm("정말로 이 리뷰를 삭제하시겠습니까?")) {
      deleteReviewMutation.mutate(reviewId);
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  if (!user) {
    setLocation('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/profile')}
          className="mb-4 text-white hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          마이페이지로 도아가기
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-white">내 리뷰</h1>
        </div>
        <p className="text-gray-400">구매한 AI 아바타와 크리에이터에 대한 리뷰를 관리할 수 있습니다.</p>
      </div>

      {/* 리뷰 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-purple-400 mb-1">
              {reviews.length}개
            </div>
            <div className="text-sm text-gray-400">총 작성 리뷰</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-1 flex items-center justify-center gap-1">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              {averageRating}
            </div>
            <div className="text-sm text-gray-400">평균 평점</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {reviews.filter(r => r.rating >= 4).length}개
            </div>
            <div className="text-sm text-gray-400">좋은 평가 (4점 이상)</div>
          </CardContent>
        </Card>
      </div>

      {/* 리뷰 목록 */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="bg-gray-800/70 border-gray-600/50">
            <CardContent className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">리뷰를 불러오는 중...</p>
            </CardContent>
          </Card>
        ) : reviews.length === 0 ? (
          <Card className="bg-gray-800/70 border-gray-600/50">
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">작성한 리뷰가 없습니다</h3>
              <p className="text-gray-400 mb-4">AI 아바타를 구매하고 첫 리뷰를 작성해보세요!</p>
              <Button onClick={() => setLocation('/shop')}>
                아바타 구매하러 가기
              </Button>
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id} className="bg-gray-800/70 border-gray-600/50 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* 상품 이미지 */}
                  <div className="flex-shrink-0">
                    <img
                      src={review.product_image}
                      alt={review.product_name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  </div>
                  
                  {/* 리뷰 내용 */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white mb-1">{review.product_name}</h3>
                        <div className="flex items-center gap-2 mb-2">
                          {renderStars(review.rating)}
                          <span className="text-sm text-gray-500">({review.rating}.0)</span>
                        </div>
                      </div>
                      
                      {/* 액션 버튼들 */}
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => handleEditReview(review)}
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              수정
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle>리뷰 수정</DialogTitle>
                            </DialogHeader>
                            
                            <div className="space-y-4 py-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={review.product_image}
                                  alt={review.product_name}
                                  className="w-12 h-12 object-cover rounded"
                                />
                                <div>
                                  <div className="font-medium text-white">{review.product_name}</div>
                                  <div className="text-sm text-gray-500">주문번호: {review.order_id}</div>
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-2 text-white">평점</label>
                                {renderStars(editRating, true, setEditRating)}
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-2 text-white">리뷰 내용</label>
                                <Textarea
                                  value={editComment}
                                  onChange={(e) => setEditComment(e.target.value)}
                                  placeholder="AI 아바타나 크리에이터에 대한 솔직한 후기를 남겨주세요."
                                  rows={4}
                                />
                              </div>
                            </div>
                            
                            <DialogFooter>
                              <Button
                                variant="default"
                                onClick={() => setEditingReview(null)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                취소
                              </Button>
                              <Button
                                onClick={handleSaveEdit}
                                disabled={updateReviewMutation.isPending || editRating === 0 || !editComment.trim()}
                              >
                                <Save className="h-4 w-4 mr-2" />
                                {updateReviewMutation.isPending ? "저장 중..." : "저장"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDeleteReview(review.id)}
                          disabled={deleteReviewMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          삭제
                        </Button>
                      </div>
                    </div>
                    
                    <p className="text-gray-300 mb-3">{review.comment}</p>
                    
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          작성일: {formatDate(review.created_at)}
                        </div>
                        {review.updated_at && (
                          <div className="flex items-center gap-1">
                            <Edit3 className="h-4 w-4" />
                            수정일: {formatDate(review.updated_at)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        주문번호: {review.order_id}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
    </div>
  );
} 