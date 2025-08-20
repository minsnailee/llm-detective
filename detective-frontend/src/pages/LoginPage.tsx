import { useState } from "react";
import { api } from "../shared/api/client";
import { useAuth } from "../store/auth.store";
import { useNavigate } from "react-router-dom";

export default function LoginPage(){
  const nav = useNavigate();
  const set = useAuth(s=>s.set);
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [err,setErr]=useState("");

  const submit=async(e:any)=>{
    e.preventDefault(); setErr("");
    try{
      const {data} = await api.post("/auth/login",{email,password});
      set({ token: data.token, user: data.user });
      nav("/");
    }catch(e:any){
      setErr("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <form onSubmit={submit} style={{display:"grid",gap:8}}>
      <h2>로그인</h2>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
      {err && <div style={{color:"crimson"}}>{err}</div>}
      <button>로그인</button>
    </form>
  );
}
