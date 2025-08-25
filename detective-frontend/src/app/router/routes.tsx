import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import AdminLayout from "../layouts/AdminLayout";

const LobbyPage = () => <div>Lobby</div>;

// const ScenarioSelectPage = () => <div>Scenario Select</div>;
import ScenarioSelectPage from "../../pages/ScenarioSelectPage";
import GamePlayPage from "../../pages/GamePlayPage";
import ResultPage from "../../pages/ResultPage";
import AnalysisPage from "../../pages/AnalysisPage";
import MyPage from "../../pages/MyPage";
import LoginPage from "../../pages/LoginPage";
import SignupPage from "../../pages/SignupPage";
import SignupCompletePage from "../../pages/SignupCompletePage";
const AdminDashboardPage = () => <div>Admin</div>;

export const router = createBrowserRouter([
    {
        element: <MainLayout />,
        children: [
            { path: "/", element: <LobbyPage /> },
            { path: "/scenarios", element: <ScenarioSelectPage /> },
            { path: "/play/:scenarioId", element: <GamePlayPage /> },
            { path: "/play/:scenarioId/result", element: <ResultPage /> },
            { path: "/play/:scenarioId/analysis", element: <AnalysisPage /> },
            { path: "/my", element: <MyPage /> },
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
