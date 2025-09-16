import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface Notice {
  id: number;
  title: string;
  content: string;
  date: string;
}

const NoticesPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notices = [] } = useQuery<Notice[]>({
    queryKey:['/api/notices']
  });

  const createNotice = useMutation({
    mutationFn: async ({title,content}:{title:string;content:string})=>{
      const res = await apiRequest('POST','/api/notices',{title,content});
      if(!res.ok) throw new Error('생성 실패');
      return res.json();
    },
    onSuccess:()=>{queryClient.invalidateQueries({queryKey:['/api/notices']});toast({title:'저장됨'});}
  });

  const updateNotice = useMutation({
    mutationFn: async ({id,title,content}:{id:number,title:string,content:string})=>{
      const res = await apiRequest('PUT',`/api/notices/${id}`,{title,content});
      if(!res.ok) throw new Error('수정 실패');
      return res.json();
    },
    onSuccess:()=>{queryClient.invalidateQueries({queryKey:['/api/notices']});toast({title:'수정됨'});}
  });

  const deleteNotice = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/notices/${id}`);
      if (!res.ok) throw new Error('삭제 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey:['/api/notices']});
      toast({title:'삭제됨', description: '공지사항이 삭제되었습니다.'});
      setDeleteDialogOpen(false);
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<Notice | null>(null);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const openAdd = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setIsModalOpen(true);
  };

  const openEdit = (notice: Notice) => {
    setEditing(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setIsModalOpen(true);
  };

  const confirmDelete = (notice: Notice) => {
    setNoticeToDelete(notice);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (noticeToDelete) {
      deleteNotice.mutate(noticeToDelete.id);
    }
  };

  const saveNotice = () => {
    if (!title.trim() || !content.trim()) return;
    if (editing) {
      updateNotice.mutate({id:editing.id,title,content});
    } else {
      createNotice.mutate({title,content});
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">공지사항</h3>
        <Button onClick={openAdd}>공지 추가</Button>
      </div>

      {notices.length === 0 ? (
        <p className="text-gray-500">등록된 공지가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {notices.map(notice => (
            <Card key={notice.id} className="cursor-pointer hover:shadow">
              <CardHeader>
                <CardTitle className="text-lg">{notice.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-2">{notice.date}</p>
                <p className="text-gray-700 line-clamp-3 whitespace-pre-wrap">{notice.content}</p>
                <div className="flex justify-between mt-3">
                  <Button size="sm" variant="outline" onClick={()=>openEdit(notice)}>
                    수정
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => confirmDelete(notice)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> 삭제
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "공지 수정" : "새 공지 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="제목" value={title} onChange={e=>setTitle(e.target.value)} />
            <Textarea placeholder="내용" value={content} onChange={e=>setContent(e.target.value)} rows={6}/>
            <div className="text-right space-x-2">
              <Button variant="outline" onClick={()=>setIsModalOpen(false)}>취소</Button>
              <Button onClick={saveNotice}>{editing ? "저장" : "추가"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 대화상자 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>공지사항 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 공지사항을 삭제하시겠습니까?<br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NoticesPage; 