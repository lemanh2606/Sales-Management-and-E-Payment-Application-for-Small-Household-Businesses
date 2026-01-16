import React, { useState, useEffect } from "react";
import Sidebar from "../components/sidebar/Sidebar";
import TrialBanner from "./sidebar/TrialBanner";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // 👈 Thêm state này
  const getIsDesktop = () => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.innerWidth >= 768;
  };
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const desktopPadding = sidebarCollapsed ? 76 : 280;
  const contentPaddingLeft = isDesktop ? desktopPadding : 0;

  return (
    <div className="flex min-h-screen bg-[#ffffff]" style={{ width: "100%", overflow: "hidden" }}>
      {/* Sidebar desktop - truyền callback để nhận trạng thái collapsed */}
      <Sidebar
        openMobile={sidebarOpen}
        setOpenMobile={setSidebarOpen}
        onCollapsedChange={setSidebarCollapsed} // 👈 Thêm prop này
        className="hidden md:block"
        style={{ flexShrink: 0 }} //không cho sidebar co lại
      />

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform md:hidden transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar openMobile={sidebarOpen} setOpenMobile={setSidebarOpen} />
      </div>

      {/* Main content - ĐIỀU CHỈNH MARGIN DỰA VÀO collapsed */}
      <div
        className="flex-1 flex flex-col transition-all duration-300"
        style={{
          width: "100%",
          overflow: "auto",
          paddingLeft: contentPaddingLeft,
          transition: "padding-left 0.3s ease",
        }}
      >
        {/* Trial Banner */}
        <TrialBanner />

        {/* Top bar mobile */}
        <header className="md:hidden p-4 shadow-md bg-white flex justify-between items-center sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-green-600 font-bold p-2 rounded-lg hover:bg-green-100 transition"
          >
            ☰
          </button>
          <h1 className="text-lg font-bold text-green-600">Smallbiz-Sales</h1>
        </header>

        <main className="p-6 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
