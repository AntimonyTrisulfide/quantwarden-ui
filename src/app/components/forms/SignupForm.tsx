"use client";
import { useState } from "react";

export default function SignupForm() {
  const [data, setData] = useState({
    email: "",
    password: "",
    orgName: "",
    domains: "",
  });

  const submit = async () => {
    await fetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });

    alert("Enterprise Created 🚀");
  };

  return (
    <div className="card p-8 rounded-2xl w-[380px]">
      <h1 className="text-3xl font-bold text-yellow-400 mb-6 text-center">
        PNB Enterprise Setup
      </h1>

      <input className="input" placeholder="Admin Email"
        onChange={e=>setData({...data,email:e.target.value})} />

      <input className="input" type="password" placeholder="Password"
        onChange={e=>setData({...data,password:e.target.value})} />

      <input className="input" placeholder="Organization Name"
        onChange={e=>setData({...data,orgName:e.target.value})} />

      <input className="input" placeholder="Allowed Domains (pnb.co.in)"
        onChange={e=>setData({...data,domains:e.target.value})} />

      <button onClick={submit} className="btn">
        Register Enterprise
      </button>
    </div>
  );
}