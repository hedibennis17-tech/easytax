import { AppNav } from "@/components/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      <div style={{ minHeight: "calc(100vh - 56px)" }}>
        {children}
      </div>
    </>
  );
}
