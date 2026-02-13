import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ContentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const contents = [
    { id:1, title:'AI 아바타 대화법 가이드', category:'AI 교육', status:'published', date:'2024-01-10' },
    { id:2, title:'AI 아바타 감정 표현 매뉴얼', category:'AI 교육', status:'draft', date:'2024-01-12' },
    { id:3, title:'챗봇 응답 품질 개선 가이드', category:'기술', status:'published', date:'2024-01-15' },
    { id:4, title:'음성 인식 최적화 팁', category:'기술', status:'draft', date:'2024-01-18' },
    { id:5, title:'사용자 맞춤형 서비스 제공 방법', category:'서비스', status:'published', date:'2024-01-20' },
  ];

  const getBadge=(st:string)=>{
    const map:any={published:'bg-green-600 text-white',draft:'bg-yellow-600 text-white',archived:'bg-gray-600 text-white'};
    return <Badge className={map[st]||'bg-gray-600 text-white'}>{st}</Badge>;
  };

  const filtered = contents.filter(c=> c.title.includes(search));

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/70 border-gray-600/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white">AI 아바타 콘텐츠 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <Input 
            value={search} 
            onChange={e=>setSearch(e.target.value)} 
            placeholder="콘텐츠 제목 검색..."
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600/50">
                  <th className="py-3 px-4 text-left text-gray-300">ID</th>
                  <th className="py-3 px-4 text-left text-gray-300">콘텐츠 제목</th>
                  <th className="py-3 px-4 text-left text-gray-300">카테고리</th>
                  <th className="py-3 px-4 text-left text-gray-300">상태</th>
                  <th className="py-3 px-4 text-left text-gray-300">등록일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c=> (
                  <tr key={c.id} className="border-b border-gray-600/50 hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-gray-300">{c.id}</td>
                    <td className="py-3 px-4 text-white font-medium">{c.title}</td>
                    <td className="py-3 px-4 text-gray-300">{c.category}</td>
                    <td className="py-3 px-4">{getBadge(c.status)}</td>
                    <td className="py-3 px-4 text-gray-400">{c.date}</td>
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

export default ContentsPage; 