import { Outlet, Link } from "react-router-dom";
export default function MainLayout(){
  return (
    <div>
      <header style={{padding:12,borderBottom:"1px solid #eee"}}>
        <Link to="/">Lobby</Link> · <Link to="/scenarios">Scenarios</Link> · <Link to="/me">My</Link> · <Link to="/login">Login</Link>
      </header>
      <main style={{padding:16}}><Outlet/></main>
    </div>
  );
}