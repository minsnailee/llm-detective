import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../shared/api/client";

export default function SignupPage(){
  const nav=useNavigate();
  const [f,setF]=useState({email:"",password:"",nickname:""});
  const [msg,setMsg]=useState<string>("");

  const submit=async(e:any)=>{
    e.preventDefault(); setMsg("");
    try{
      await api.post("/auth/signup",f);
      setMsg("가입 완료! 로그인 페이지로 이동합니다.");
      nav("/login");
    }catch(e:any){
      setMsg("이미 가입된 이메일일 수 있어요.");
    }
  };

  return (
    <form onSubmit={submit} style={{display:"grid",gap:8}}>
      <h2>회원가입</h2>
      <input placeholder="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
      <input placeholder="nickname" value={f.nickname} onChange={e=>setF({...f,nickname:e.target.value})}/>
      <input placeholder="password" type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/>
      {msg && <div>{msg}</div>}
      <button>가입</button>
    </form>
  );
}
