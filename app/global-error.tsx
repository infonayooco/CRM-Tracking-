"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Catches errors thrown in the root layout itself. It replaces the root layout
// when active, so it must render its own <html>/<body> and cannot rely on
// Tailwind or global styles — hence the inline styles below.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[task-list-ja] fatal", error);
  }, [error]);

  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f1f5f9",
          fontFamily: "system-ui, sans-serif",
          color: "#0f172a",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "1rem",
            padding: "1.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            เกิดข้อผิดพลาดร้ายแรง
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1.25rem" }}>
            ระบบทำงานผิดพลาด ข้อมูลของคุณยังอยู่ในเบราว์เซอร์ ลองใหม่อีกครั้งได้เลย
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              height: "2.5rem",
              padding: "0 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#4f46e5",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
