import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import AdminLayout from "../layouts/AdminLayout";

const LobbyPage = () => <div>Lobby</div>;

// const ScenarioSelectPage = () => <div>Scenario Select</div>;
import ScenarioSelectPage from "../../pages/game/ScenarioSelectPage";
import GamePlayPage from "../../pages/game/GamePlayPage";
import ResultPage from "../../pages/game/ResultPage";
import AnalysisPage from "../../pages/game/AnalysisPage";
import MyPageLayout from "../../pages/mypage/MyPageLayout";
import LoginPage from "../../pages/LoginPage";
import SignupPage from "../../pages/SignupPage";
import SignupCompletePage from "../../pages/SignupCompletePage";
import AdminDashboardPage from "../../pages/admin/AdminDashboardPage";
import GameResultDetailPage from "../../pages/mypage/GameResultDetailPage";
import AccountInfoPage from "../../pages/mypage/AccountInfoPage";
import RequestExpertPage from "../../pages/mypage/RequestExpertPage";
import GameHistoryPage from "../../pages/mypage/GameHistoryPage";
import ExpertScenarioPage from "../../pages/mypage/ExpertScenarioPage";

export const router = createBrowserRouter([
    {
        element: <MainLayout />,
        children: [
            { path: "/", element: <LobbyPage /> },
            { path: "/scenarios", element: <ScenarioSelectPage /> },
            { path: "/play/:scenarioId", element: <GamePlayPage /> },
            { path: "/play/:scenarioId/result", element: <ResultPage /> },
            { path: "/play/:scenarioId/analysis", element: <AnalysisPage /> },
            {
                path: "/my",
                element: <MyPageLayout />,
                children: [
                    { path: "account", element: <AccountInfoPage /> },
                    { path: "request-expert", element: <RequestExpertPage /> },
                    { path: "history", element: <GameHistoryPage /> },
                    { path: "game-result/:resultId", element: <GameResultDetailPage /> },
                    { path: "expert-scenario", element: <ExpertScenarioPage /> },
                ],
            },
        ],
    },
    {
        element: <AuthLayout />,
        children: [
            { path: "/login", element: <LoginPage /> },
            { path: "/signup", element: <SignupPage /> },
            { path: "/signup/complete", element: <SignupCompletePage /> },
        ],
    },
    {
        element: <AdminLayout />,
        children: [{ path: "/admin", element: <AdminDashboardPage /> }],
    },
]);
