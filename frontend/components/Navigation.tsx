"use client";

import Link from "next/link";

export default function Navigation() {
  return (
    <nav className="sticky top-0 z-50 bg-gray-700 border-b-4 border-gray-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="text-xl font-minecraft text-white hover:text-yellow-300 transition-colors"
            >
              Work Toolbox
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                href="/reimburse"
                className="retro-btn retro-btn-primary px-4 py-2 text-sm font-minecraft hover:bg-blue-600 transition-colors"
              >
                Reimburse
              </Link>
              <Link
                href="/doc-rename"
                className="retro-btn retro-btn-secondary px-4 py-2 text-sm font-minecraft hover:bg-green-600 transition-colors"
              >
                Doc Rename
              </Link>
              <Link
                href="/doc-redact"
                className="retro-btn retro-btn-warning px-4 py-2 text-sm font-minecraft hover:bg-red-600 transition-colors"
              >
                Doc Redact
              </Link>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              type="button"
              className="retro-btn retro-btn-primary p-2 text-sm font-minecraft"
              aria-controls="mobile-menu"
              aria-expanded="false"
              onClick={() => {
                const mobileMenu = document.getElementById("mobile-menu");
                if (mobileMenu) {
                  mobileMenu.classList.toggle("hidden");
                }
              }}
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="block h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden hidden" id="mobile-menu">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-800">
          <Link
            href="/reimburse"
            className="retro-btn retro-btn-primary block px-3 py-2 text-base font-minecraft w-full text-left"
          >
            Reimburse
          </Link>
          <Link
            href="/doc-rename"
            className="retro-btn retro-btn-secondary block px-3 py-2 text-base font-minecraft w-full text-left"
          >
            Doc Rename
          </Link>
          <Link
            href="/doc-redact"
            className="retro-btn retro-btn-warning block px-3 py-2 text-base font-minecraft w-full text-left"
          >
            Doc Redact
          </Link>
        </div>
      </div>
    </nav>
  );
}
