import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const SettlementsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const data = [
    { id: 1, serviceId: 'SRV-2024-001', name: '김영희', amount: 45000, commission: 6750, status: 'pending', date: '2024-01-15' },
    { id: 2, serviceId: 'SRV-2024-002', name: '이수진', amount: 35000, commission: 5250, status: 'completed', date: '2024-01-16' },
  ];

  const getBadge = (status:string)=> {
    const map:any={pending:'bg-yellow-600 text-white',completed:'bg-green-600 text-white',rejected:'bg-red-600 text-white'};
    return <Badge className={map[status]||'bg-gray-600 text-white'}>{
      status === 'pending' ? '대기중' :
      status === 'completed' ? '완료' :
      status === 'rejected' ? '반려' : status
    }</Badge>;
  };

  const filtered = data.filter(d=> (statusFilter==='all'||d.status===statusFilter) && (
    d.serviceId.includes(searchTerm)||d.name.includes(searchTerm)));

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/70 border-gray-600/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white">AI 아바타 정산 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex gap-2">
            <Input 
              placeholder="서비스 ID 또는 AI 아바타 이름 검색..." 
              value={searchTerm} 
              onChange={e=>setSearchTerm(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="all" className="text-white hover:bg-gray-700">전체</SelectItem>
                <SelectItem value="pending" className="text-white hover:bg-gray-700">대기</SelectItem>
                <SelectItem value="completed" className="text-white hover:bg-gray-700">완료</SelectItem>
                <SelectItem value="rejected" className="text-white hover:bg-gray-700">반려</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600/50">
                  <th className="py-3 px-4 text-left text-gray-300">서비스 ID</th>
                  <th className="py-3 px-4 text-left text-gray-300">AI 아바타</th>
                  <th className="py-3 px-4 text-right text-gray-300">서비스 금액</th>
                  <th className="py-3 px-4 text-right text-gray-300">플랫폼 수수료</th>
                  <th className="py-3 px-4 text-right text-gray-300">정산 금액</th>
                  <th className="py-3 px-4 text-left text-gray-300">처리 상태</th>
                  <th className="py-3 px-4 text-left text-gray-300">정산일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item=> (
                  <tr key={item.id} className="border-b border-gray-600/50 hover:bg-gray-700/50">
                    <td className="py-3 px-4 font-mono text-blue-400">{item.serviceId}</td>
                    <td className="py-3 px-4 text-white font-medium">{item.name}</td>
                    <td className="py-3 px-4 text-right text-white">{item.amount.toLocaleString()}원</td>
                    <td className="py-3 px-4 text-right text-gray-300">{item.commission.toLocaleString()}원</td>
                    <td className="py-3 px-4 text-right text-green-400 font-medium">{(item.amount - item.commission).toLocaleString()}원</td>
                    <td className="py-3 px-4">{getBadge(item.status)}</td>
                    <td className="py-3 px-4 text-gray-400">{item.date}</td>
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

export default SettlementsPage; 