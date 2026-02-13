import { Switch, Route, useParams } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthModal from "@/components/auth-modal";
import Header from "@/components/header";
import Home from "@/pages/home";
import DiscordHome from "@/pages/discord-home";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";
import KakaoCallback from "@/pages/oauth/kakao/callback";
import ProductDetailPage from "@/pages/product-detail";
import ShopPage from "@/pages/shop";
import CheckoutPage from "@/pages/checkout";
import CheckoutCompletePage from "@/pages/checkout-complete";
import OrdersPage from "@/pages/orders";
import AvatarStudio from "@/pages/avatar-studio";
import ProductDetailLayout from "@/components/discord/ProductDetailLayout";
import CheckoutWrapper from "@/components/discord/CheckoutWrapper";
import BookingsPage from "@/pages/bookings";
import PaymentHistoryPage from "@/pages/payment-history";
import MyReviewsPage from "@/pages/my-reviews";
import MyInquiriesPage from "@/pages/my-inquiries";
import FavoritesPage from "@/pages/favorites";
import NotificationsPage from "@/pages/notifications";
import PrivacyPage from "@/pages/privacy";
import SupportPage from "@/pages/support";
import SearchPage from "@/pages/search";
import CareManagerDetailPage from "@/pages/care-manager-detail";
import NoticesPage from "@/pages/notices";
import CartPage from "@/pages/cart";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import HelpCenterPage from "@/pages/help-center-page";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import TermsOfServicePage from "@/pages/terms-of-service";
import CookiePolicyPage from "@/pages/cookie-policy";
import FeedCreatePage from "@/pages/feed-create";
import ChannelPage from "@/pages/channel";

// 상품 상세 페이지 래퍼 컴포넌트
function ProductDetailWrapper() {
  const { productId } = useParams();
  return <ProductDetailLayout productId={productId || ""} />;
}

// 크리에이터상세 페이지 래퍼 컴포넌트
function CareManagerDetailWrapper() {
  const { id } = useParams();
  return <CareManagerDetailPage id={id || ""} />;
}

function Router() {
  return (
    <div className="w-full bg-gray-900" style={{ margin: 0, padding: 0 }}>
      <Switch>
        <Route path="/">
          <Home />
        </Route>
        <Route path="/chat">
          <div
            className="h-screen flex flex-col overflow-hidden"
            style={{ paddingTop: "40px" }}
          >
            <Header />
            <div className="flex-1 overflow-hidden">
              <DiscordHome />
            </div>
          </div>
        </Route>
        <Route path="/profile">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, padding: 0 }}
          >
            <Profile />
          </div>
        </Route>
        <Route path="/oauth/kakao/callback" component={KakaoCallback} />
        <Route path="/discord">
          <div
            className="h-screen flex flex-col overflow-hidden"
            style={{ paddingTop: "40px" }}
          >
            <Header />
            <div className="flex-1 overflow-hidden">
              <DiscordHome />
            </div>
          </div>
        </Route>
        <Route path="/feed/create">
          <FeedCreatePage />
        </Route>
        <Route path="/feed/:postId">
          <div
            className="h-screen flex flex-col overflow-hidden"
            style={{ paddingTop: "40px" }}
          >
            <Header />
            <div className="flex-1 overflow-hidden">
              <DiscordHome />
            </div>
          </div>
        </Route>
        <Route path="/channel/:userId">
          <div
            className="h-screen flex flex-col overflow-hidden"
            style={{ paddingTop: "40px" }}
          >
            <Header />
            <div className="flex-1 overflow-hidden">
              <DiscordHome />
            </div>
          </div>
        </Route>
        <Route path="/discord-home">
          <div
            className="h-screen flex flex-col overflow-hidden"
            style={{ paddingTop: "40px" }}
          >
            <Header />
            <div className="flex-1 overflow-hidden">
              <DiscordHome />
            </div>
          </div>
        </Route>
        <Route path="/shop/product/:productId">
          {/* 독립 상품 상세 페이지 (헤더 포함) - 더 구체적인 라우트를 먼저 배치 */}
          <div className="min-h-screen bg-white dark:bg-[#030303]">
            <ProductDetailPage />
          </div>
        </Route>
        <Route path="/product/:productId">
          {/* Discord 레이아웃 내 상품 상세 */}
          <ProductDetailWrapper />
        </Route>
        <Route path="/shop">
          <div
            className="h-screen flex flex-col overflow-hidden"
            style={{ paddingTop: "40px" }}
          >
            <Header />
            <div className="flex-1 overflow-hidden">
              <DiscordHome />
            </div>
          </div>
        </Route>
        <Route path="/cart">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <CartPage />
          </div>
        </Route>
        <Route path="/checkout">
          <CheckoutWrapper />
        </Route>
        <Route path="/checkout/complete">
          <CheckoutWrapper isComplete={true} />
        </Route>
        <Route path="/orders">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, padding: 0 }}
          >
            <OrdersPage />
          </div>
        </Route>
        <Route path="/avatar-studio">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <AvatarStudio />
          </div>
        </Route>
        <Route path="/bookings">
          <BookingsPage />
        </Route>
        <Route path="/commissions">
          <BookingsPage />
        </Route>
        <Route path="/payment-history">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <PaymentHistoryPage />
          </div>
        </Route>
        <Route path="/my-reviews">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <MyReviewsPage />
          </div>
        </Route>
        <Route path="/my-inquiries">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <MyInquiriesPage />
          </div>
        </Route>
        <Route path="/favorites">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <FavoritesPage />
          </div>
        </Route>
        <Route path="/notifications">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <NotificationsPage />
          </div>
        </Route>
        <Route path="/privacy">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <PrivacyPage />
          </div>
        </Route>
        <Route path="/support">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <SupportPage />
          </div>
        </Route>
        <Route path="/search">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <SearchPage />
          </div>
        </Route>
        <Route path="/care-manager/:id">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <CareManagerDetailWrapper />
          </div>
        </Route>
        <Route path="/notices">
          <NoticesPage />
        </Route>
        <Route path="/help-center">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <HelpCenterPage />
          </div>
        </Route>
        <Route path="/privacy-policy">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <PrivacyPolicyPage />
          </div>
        </Route>
        <Route path="/terms">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <TermsOfServicePage />
          </div>
        </Route>
        <Route path="/cookie-policy">
          <div
            className="min-h-screen bg-white dark:bg-[#030303] w-full"
            style={{ margin: 0, paddingTop: "40px" }}
          >
            <Header />
            <CookiePolicyPage />
          </div>
        </Route>
        <Route>
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
            <NotFound />
          </div>
        </Route>
      </Switch>
      <AuthModal />
      <PWAInstallPrompt />
    </div>
  );
}

export default function App() {
  return (
    <div
      className="w-full bg-white dark:bg-gray-900 transition-colors"
      style={{ margin: 0, padding: 0, minHeight: "100vh" }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </div>
  );
}
