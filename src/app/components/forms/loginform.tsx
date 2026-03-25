"use client";
import { useState } from "react";

export default function LoginForm() {
  const [data, setData] = useState({
    email: "",
    password: "",
  });

  const login = async () => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.success) {
      alert("Login Success 🚀");
    } else {
      alert("Invalid credentials");
    }
  };

  return (
    <div className="card p-8 rounded-2xl w-[380px]">
      <h1 className="text-3xl font-bold text-yellow-400 mb-6 text-center">
        PNB Secure Login
      </h1>

      <input className="input" placeholder="Email"
        onChange={e=>setData({...data,email:e.target.value})} />

      <input className="input" type="password" placeholder="Password"
        onChange={e=>setData({...data,password:e.target.value})} />

      <button onClick={login} className="btn">
        Login
      </button>
    </div>
  );
}