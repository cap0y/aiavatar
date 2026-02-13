import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MembersPage = () => {
  const { data: members = [] } = useQuery<any[]>({ queryKey: ['/api/users'] });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  // 임시 더미 데이터 (API가 없을 경우)
  const defaultMembers = members.length === 0 ? [
    { id: 1, email: 'user1@example.com', name: '김영희', userType: 'ai_avatar', status: 'active', joinDate: '2024-01-10' },
    { id: 2, email: 'user2@example.com', name: '이민수', userType: 'customer', status: 'active', joinDate: '2024-01-15' },
    { id: 3, email: 'user3@example.com', name: '박정원', userType: 'ai_avatar', status: 'pending', joinDate: '2024-01-20' },
    { id: 4, email: 'user4@example.com', name: '최수정', userType: 'customer', status: 'active', joinDate: '2024-01-22' },
  ] : members;

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'bg-green-600 text-white',
      pending: 'bg-yellow-600 text-white',
      inactive: 'bg-red-600 text-white',
      suspended: 'bg-gray-600 text-white'
    };
    return <Badge className={statusMap[status] || 'bg-gray-600 text-white'}>{
      status === 'active' ? '활성' :
      status === 'pending' ? '승인대기' :
      status === 'inactive' ? '비활성' :
      status === 'suspended' ? '정지' : status
    }</Badge>;
  };

  const getUserTypeBadge = (userType: string) => {
    const typeMap: Record<string, string> = {
      ai_avatar: 'bg-blue-600 text-white',
      customer: 'bg-purple-600 text-white',
      admin: 'bg-indigo-600 text-white'
    };
    return <Badge className={typeMap[userType] || 'bg-gray-600 text-white'}>{
      userType === 'ai_avatar' ? 'AI 아바타' :
      userType === 'customer' ? '고객' :
      userType === 'admin' ? '관리자' : userType
    }</Badge>;
  };

  // 사용자 관리 핸들러
  const handleManageUser = (user: any) => {
    setSelectedUser(user);
    setNewStatus(user.status);
    setShowManageDialog(true);
  };

  // 상태 변경 처리
  const handleStatusChange = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('상태 변경 실패');
      }

      const updatedUser = await response.json();
      console.log("사용자 상태 변경 완료:", updatedUser);

      toast({
        title: "회원 상태 변경 완료",
        description: `${selectedUser.name}님의 상태가 ${
          newStatus === 'active' ? '활성' :
          newStatus === 'pending' ? '승인대기' :
          newStatus === 'inactive' ? '비활성' :
          newStatus === 'suspended' ? '정지' : newStatus
        }(으)로 변경되었습니다.`,
      });

      setShowManageDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    } catch (error) {
      console.error("상태 변경 오류:", error);
      toast({
        title: "상태 변경 실패",
        description: "회원 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/70 border-gray-600/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white">AI 아바타 및 사용자 관리</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-600/50">
                  <th className="py-3 px-4 text-gray-300">ID</th>
                  <th className="py-3 px-4 text-gray-300">이메일</th>
                  <th className="py-3 px-4 text-gray-300">이름</th>
                  <th className="py-3 px-4 text-gray-300">계정 유형</th>
                  <th className="py-3 px-4 text-gray-300">상태</th>
                  <th className="py-3 px-4 text-gray-300">가입일</th>
                  <th className="py-3 px-4 text-gray-300">작업</th>
                </tr>
              </thead>
              <tbody>
                {defaultMembers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-600/50 hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-gray-300">{u.id}</td>
                    <td className="py-3 px-4 text-white">{u.email}</td>
                    <td className="py-3 px-4 text-white font-medium">{u.name}</td>
                    <td className="py-3 px-4">{getUserTypeBadge(u.userType)}</td>
                    <td className="py-3 px-4">{getStatusBadge(u.status)}</td>
                    <td className="py-3 px-4 text-gray-400">{u.joinDate}</td>
                    <td className="py-3 px-4">
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                        onClick={() => handleManageUser(u)}
                      >
                        관리
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 회원 관리 다이얼로그 */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="sm:max-w-[500px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">회원 관리</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedUser?.name}님의 계정을 관리합니다.
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 py-4">
              {/* 회원 정보 */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-400 mb-1">이메일</p>
                  <p className="text-sm text-white">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">이름</p>
                  <p className="text-sm text-white">{selectedUser.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">계정 유형</p>
                  <div>{getUserTypeBadge(selectedUser.userType)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">가입일</p>
                  <p className="text-sm text-white">{selectedUser.joinDate}</p>
                </div>
              </div>

              {/* 상태 변경 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">계정 상태 변경</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="active" className="text-white hover:bg-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        활성
                      </div>
                    </SelectItem>
                    <SelectItem value="pending" className="text-white hover:bg-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        승인 대기
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive" className="text-white hover:bg-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        비활성
                      </div>
                    </SelectItem>
                    <SelectItem value="suspended" className="text-white hover:bg-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        정지
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI 아바타인 경우 추가 정보 */}
              {selectedUser.userType === 'ai_avatar' && selectedUser.status === 'pending' && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400 flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    AI 아바타 승인 대기 중입니다. 상태를 "활성"으로 변경하여 승인하세요.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowManageDialog(false)}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              취소
            </Button>
            <Button
              onClick={handleStatusChange}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              변경 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MembersPage; 