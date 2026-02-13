import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DisputesPage = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 분쟁 목록 fetch
  const { data: disputes = [] } = useQuery<any[]>({
    queryKey:['/api/disputes'],
    queryFn: async ()=> {
      const res= await apiRequest('GET','/api/disputes');
      if(!res.ok) throw new Error('분쟁 목록 로드 실패');
      return res.json();
    }
  });

  // 상태 변경 mutation
  const updateStatus = useMutation({
    mutationFn: async ({id,status}:{id:number,status:string})=>{
      const res = await apiRequest('PUT',`/api/disputes/${id}/status`,{status});
      if(!res.ok) throw new Error('상태 업데이트 실패');
      return res.json();
    },
    onSuccess:()=>{
      queryClient.invalidateQueries({queryKey:['/api/disputes']});
    },
    onError:(e:any)=> toast({title:'변경 실패',description:e.message,variant:'destructive'})
  });

  const getBadge = (st:string)=>{
    const m:any={received:'bg-gray-600 text-white',processing:'bg-yellow-600 text-white',completed:'bg-green-600 text-white',cancelled:'bg-red-600 text-white'};
    return <Badge className={m[st]||'bg-gray-600 text-white'}>{
      st === 'received' ? '접수' :
      st === 'processing' ? '처리중' :
      st === 'completed' ? '완료' :
      st === 'cancelled' ? '취소' : st
    }</Badge>;
  };

  const filtered = disputes.filter(d=> (status==='all'||d.status===status)&&(d.disputeId.includes(search)||d.reporter.includes(search)||d.target.includes(search)));

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/70 border-gray-600/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white">AI 아바타 분쟁 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <Input 
            value={search} 
            onChange={e=>setSearch(e.target.value)} 
            placeholder="분쟁 ID, 신고자, 대상자 검색..."
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600/50">
                  <th className="py-3 px-4 text-left text-gray-300">분쟁 ID</th>
                  <th className="py-3 px-4 text-left text-gray-300">신고자</th>
                  <th className="py-3 px-4 text-left text-gray-300">대상 AI 아바타</th>
                  <th className="py-3 px-4 text-left text-gray-300">분쟁 유형</th>
                  <th className="py-3 px-4 text-left text-gray-300">상태</th>
                  <th className="py-3 px-4 text-left text-gray-300">상태 변경</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d=> (
                  <tr key={d.id} className="border-b border-gray-600/50 hover:bg-gray-700/50">
                    <td className="py-3 px-4 font-mono text-blue-400">{d.disputeId}</td>
                    <td className="py-3 px-4 text-white">{d.reporter}</td>
                    <td className="py-3 px-4 text-white">{d.target}</td>
                    <td className="py-3 px-4 text-gray-300">{d.type}</td>
                    <td className="py-3 px-4">{getBadge(d.status)}</td>
                    <td className="py-3 px-4">
                      <Select defaultValue={d.status} onValueChange={(val)=> updateStatus.mutate({id:d.id,status:val})}>
                        <SelectTrigger className="w-28 h-8 bg-gray-700 border-gray-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-600">
                          <SelectItem value="received" className="text-white hover:bg-gray-700">접수</SelectItem>
                          <SelectItem value="processing" className="text-white hover:bg-gray-700">처리중</SelectItem>
                          <SelectItem value="completed" className="text-white hover:bg-gray-700">완료</SelectItem>
                          <SelectItem value="cancelled" className="text-white hover:bg-gray-700">취소</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DisputesPage; 