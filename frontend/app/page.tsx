import Navigation from "@/components/Navigation";

export default function Home() {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(135deg, #c1c1c1 0%, #a8a8a8 50%, #c1c1c1 100%)",
      }}
    >
      {/* Retro CRT scanlines effect */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,.1) 2px,
              rgba(0,0,0,.1) 4px
            ),
            linear-gradient(rgba(128,128,128,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(128,128,128,.05) 1px, transparent 1px)
          `,
            backgroundSize: "100% 4px, 40px 40px, 40px 40px",
          }}
        ></div>
      </div>

      {/* Old computer monitor bezel effect */}
      <div className="absolute inset-0 border-8 border-gray-900 shadow-inner"></div>

      <Navigation />

      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-8">
        <div className="text-center space-y-8">
          <h1
            className="text-6xl font-minecraft text-green-400 drop-shadow-lg filter brightness-110"
            style={{
              textShadow:
                "0 0 10px rgba(34, 197, 94, 0.5), 0 0 20px rgba(34, 197, 94, 0.3)",
            }}
          >
            Boring Stuff
          </h1>
          <p className="text-xl font-minecraft text-green-300 max-w-2xl">
            Your retro-style workspace for document management and
            reimbursements
          </p>

          {/* Retro-style welcome card with terminal look */}
          <div className="retro-container bg-gray-800/80 border-4 border-green-500 backdrop-blur-sm p-8 max-w-md mx-auto mt-8">
            <div className="border-b border-green-500 pb-2 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-400 font-minecraft text-xs ml-2">
                  TERMINAL v1.0
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-minecraft text-green-400 mb-4">
              &gt; Welcome!
            </h2>
            <p className="font-minecraft text-green-300 text-sm leading-relaxed">
              &gt; Select a tool from the navigation above to get started with
              your tasks.
              <span className="animate-pulse">_</span>
            </p>
          </div>
        </div>

        {/* Retro floating elements with old computer colors */}
        <div className="absolute top-20 left-10 w-4 h-4 bg-amber-400 opacity-60 animate-pulse shadow-lg"></div>
        <div className="absolute top-40 right-20 w-6 h-6 bg-green-400 opacity-60 animate-pulse delay-1000 shadow-lg"></div>
        <div className="absolute bottom-32 left-20 w-5 h-5 bg-cyan-400 opacity-60 animate-pulse delay-2000 shadow-lg"></div>
        <div className="absolute bottom-20 right-10 w-3 h-3 bg-orange-400 opacity-60 animate-pulse delay-500 shadow-lg"></div>

        {/* Old school decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-gray-500 opacity-40 rotate-45"></div>
        <div className="absolute top-3/4 right-1/4 w-2 h-2 bg-gray-500 opacity-40 rotate-45"></div>
      </main>
    </div>
  );
}
