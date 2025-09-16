import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthModal from "@/components/auth-modal";
import Home from "@/pages/home";
import DiscordHome from "@/pages/discord-home";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";
import KakaoCallback from "@/pages/oauth/kakao/callback";

function Router() {
  return (
    <div>
      <Switch>
        <Route path="/">
          <Home />
        </Route>
        <Route path="/chat">
          <div className="h-screen overflow-hidden">
            <DiscordHome />
          </div>
        </Route>
        <Route path="/profile">
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
            <Profile />
          </div>
        </Route>
        <Route path="/oauth/kakao/callback" component={KakaoCallback} />
        <Route>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
            <NotFound />
          </div>
        </Route>
      </Switch>
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
