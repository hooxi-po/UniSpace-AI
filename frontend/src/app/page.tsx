"use client";

import Image from "next/image";
import { useState } from "react";

type HelloResponse = {
  message?: string;
  ok?: boolean;
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HelloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callBackend = async () => {
    setLoading(true);
    setError(null);

    try {
      // 直接请求后端（后端已在 8080 端口并配置了 CORS）
      const res = await fetch("http://localhost:8080/api/hello");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as HelloResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between bg-white px-16 py-32 dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />

        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-md text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Next.js + Spring Boot（前后端分离）
          </h1>

          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            点击下面按钮调用后端接口：<code>/api/hello</code>
          </p>

          <div className="flex flex-col gap-3">
            <button
              className="h-12 rounded-full bg-black px-5 text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              onClick={callBackend}
              disabled={loading}
            >
              {loading ? "请求中..." : "请求后端 /api/hello"}
            </button>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                Error: {error}
              </div>
            )}

            {data && (
              <pre className="w-full rounded-md border border-black/[.08] bg-black/[.02] px-4 py-3 text-sm text-black dark:border-white/[.145] dark:bg-white/[.06] dark:text-white">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next.js Docs
          </a>
        </div>
      </main>
    </div>
  );
}
