import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import AdminLayout from "../layouts/AdminLayout";

const LobbyPage = () => <div>Lobby</div>;
const ScenarioSelectPage = () => <div>Scenario Select</div>;
const GamePlayPage = () => <div>Game Play</div>;
const MyPage = () => <div>My Page</div>;
import LoginPage from "../../pages/LoginPage";
import SignupPage from "../../pages/SignupPage";
const AdminDashboardPage = () => <div>Admin</div>;

export const router = createBrowserRouter([
  {
    element: <MainLayout/>,
    children: [
      { path: "/", element: <LobbyPage/> },
      { path: "/scenarios", element: <ScenarioSelectPage/> },
      { path: "/play/:scenarioId", element: <GamePlayPage/> },
      { path: "/me", element: <MyPage/> },
    ]
  },
  {
    element: <AuthLayout/>,
    children: [
      { path: "/login", element: <LoginPage/> },
      { path: "/signup", element: <SignupPage/> },
    ]
  },
  {
    element: <AdminLayout/>,
    children: [{ path: "/admin", element: <AdminDashboardPage/> }]
  }
]);
