import { create } from "zustand";
type User = { id:number; email:string; nickname:string; role:"MEMBER"|"ADMIN" };
type State = { token?:string; user?:User; set:(p:Partial<State>)=>void; logout:()=>void };
export const useAuth = create<State>((set)=>({
  set: (p)=>set(p),
  logout: ()=>set({ token: undefined, user: undefined })
}));
